from flask import Flask, render_template, url_for, request, jsonify
import ail_typo_squatting
import math
from uuid import uuid4
import configparser
import os
import json
import redis
import hashlib

import requests

from queue import Queue
from threading import Thread


##########
## CONF ##
##########

pathConf = './conf/conf.cfg'

if os.path.isfile(pathConf):
    config = configparser.ConfigParser()
    config.read(pathConf)
else:
    print("[-] No conf file found")
    exit(-1)

if 'Flask_server' in config:
    FLASK_PORT = int(config['Flask_server']['port'])
    FLASK_URL = config['Flask_server']['ip']
else:
    FLASK_URL = '127.0.0.1'
    FLASK_PORT = 7005

if 'Thread' in config:
    num_threads = int(config['Thread']['num_threads'])
else:
    num_threads = 10

if 'redis' in config:
    red = redis.Redis(host=config['redis']['host'], port=config['redis']['port'], db=config['redis']['db'])
else:
    red = redis.Redis(host='localhost', port=6379, db=2)

if 'cache' in config:
    cache_expire = config['cache']['expire']
else:
    cache_expire = 86400

sessions = list()

with open("./etc/algo_list.json", "r") as read_json:
    algo_list = json.load(read_json)


#########
## APP ##
#########

app = Flask(__name__)
# app.debug = True
app.config['JSONIFY_PRETTYPRINT_REGULAR'] = True



class Session():
    def __init__(self, url):
        self.id = str(uuid4())
        self.url = url
        self.thread_count = num_threads
        self.jobs = Queue(maxsize=0)
        self.threads = []
        self.variations_list = list()
        self.result = list()
        self.stopped = False
        self.result_stopped = dict()
        self.add_data = False

        self.result_algo = dict()
        for key in list(algo_list.keys()):
            self.result_algo[key] = []
        self.result_algo['original'] = []

        self.md5Url = hashlib.md5(url.encode()).hexdigest()

    def scan(self):
        """Start all worker"""
        for i in range(len(self.variations_list)):
            #need the index and the url in each queue item.
            self.jobs.put((i, self.variations_list[i]))
        for _ in range(self.thread_count):
            worker = Thread(target=self.crawl)
            worker.daemon = True
            worker.start()
            self.threads.append(worker)


    def geoIp(self, ip):
        """Geolocation for an IP"""
        response = requests.get(f"https://ip.circl.lu/geolookup/{ip}")
        response_json = response.json()
        return response_json[0]['country_info']['Country'] 


    def crawl(self):
        """Threaded function for queue processing."""
        while not self.jobs.empty():
            work = self.jobs.get()   #fetch new work from the Queue
            # print()
            try:
                flag = False
                ## If redis have some domains cached, don't resolve it again
                if self.result_stopped:
                    if work[1][1] in list(self.result_stopped.keys()):
                        for domain in self.result_stopped[work[1][1]]:
                            if list(domain.keys())[0] == work[1][0]:
                                data = domain
                                flag = True
                ## Redis doesn't have this domain in is db
                if not flag:
                    if app.debug:
                        data = ail_typo_squatting.dnsResolving([work[1][0]], self.url, "-", verbose=True)
                    else:
                        data = ail_typo_squatting.dnsResolving([work[1][0]], self.url, "")

                    if 'A' in data[work[1][0]].keys():
                        data[work[1][0]]['geoip'] = self.geoIp(data[work[1][0]]['A'][0])
                    elif 'AAAA' in data.keys():
                        data[work[1][0]]['geoip'] = self.geoIp(data[work[1][0]]['AAAA'][0])  

                    # Delete empty MX records
                    loc_list = list()
                    for i in range(0, len(data[work[1][0]]['MX'])):
                        if "localhost" in data[work[1][0]]['MX'][i] or len(data[work[1][0]]['MX'][i]) < 4:
                            loc_list.append(i)
                        else:
                            data[work[1][0]]['MX'][i] = data[work[1][0]]['MX'][i][:-1]
                    
                    for index in loc_list:
                        del data[work[1][0]]['MX'][index]
                    
                    # Parse NS record to remove end point
                    for i in range(0, len(data[work[1][0]]['NS'])):
                        data[work[1][0]]['NS'][i] = data[work[1][0]]['NS'][i][:-1]

                    data[work[1][0]]['variation'] = work[1][1]
                    self.add_data = True
                    
                self.result[work[0]] = data         #Store data back at correct index
                self.result_algo[work[1][1]].append(data)
            except Exception as e:
                if app.debug:
                    print(e)
                bad_result = dict()
                bad_result[work[1][0]] = {"NotExist":True}
                self.result[work[0]] = bad_result
                self.result_algo[work[1][1]].append(bad_result)
            finally:
                #signal to the queue that task has been processed
                self.jobs.task_done()
        return True

    def status(self):
        """Status of the current queue"""
        if self.jobs.empty():
            self.stop()

        total = len(self.variations_list)
        remaining = max(self.jobs.qsize(), len(self.threads))
        complete = total - remaining
        registered = sum([1 for x in self.result.copy() for e in x if not x[e]["NotExist"]])

        return {
            'id': self.id,
            'total': total,
            'complete': complete,
            'remaining': remaining,
            'registered': registered,
            'stopped' : self.stopped
            }

    def stop(self):
        """Stop the current queue and worker"""
        self.jobs.queue.clear()

        for worker in self.threads:
            worker.join(1.5)

        self.threads.clear()
        self.saveInfo()


    def domains(self):
        """Return all accessible domains"""
        domain = [x for x in self.result.copy() for e in x if not x[e]["NotExist"]]
        return domain
    
    def callVariations(self, data_dict):
        """Generate variations by options"""
        all_keys = data_dict.keys()
        if "runAll" in all_keys:
            self.variations_list = ail_typo_squatting.runAll(self.url, math.inf, 'txt', "-", givevariations=True)
        else:
            for key in all_keys:
                if key in list(algo_list.keys()):
                    fun = getattr(ail_typo_squatting, key)
                    self.variations_list = fun(self.url, self.variations_list, verbose=False, limit=math.inf, givevariations=True)

        self.variations_list.insert(0, [self.url, "original"])
        self.result = [{} for x in self.variations_list]

    def dl_list(self):
        """list of variations to string"""
        s = ''
        for variation in self.variations_list:
            s += variation[0] + '\n'
        return s

    def dl_domains(self):
        return self.result_algo
        
    def saveInfo(self):
        saveInfo = dict()
        saveInfo['url'] = self.url
        saveInfo['result_list'] = self.result
        saveInfo['variations_list'] = self.variations_list
        saveInfo['stopped'] = self.stopped
        saveInfo['md5Url'] = self.md5Url

        red.set(self.id, json.dumps(saveInfo))
        red.expire(self.id, 3600) # 1h
        red.set(self.md5Url, 1)
        red.expire(self.md5Url, cache_expire) # 24h

        for key in self.result_algo:
            ## Check only request algo
            if self.result_algo[key]:
                flag = False
                ## Domain already in redis and add additionnal data to it
                ## Normaly it's because a stop has been done previously
                if self.add_data:
                    if red.exists(f"{self.md5Url}:{key}"):
                        ## Load json to update it with new domain
                        algo_redis = json.loads(red.get(f"{self.md5Url}:{key}").decode())
                        for domain in self.result_algo[key]:
                            if not domain in algo_redis:
                                algo_redis.append(domain)
                                flag = True
                                red.set(f"{self.md5Url}:{key}", json.dumps(algo_redis))
                                red.expire(f"{self.md5Url}:{key}", cache_expire)

                ## For the domain name, add algo
                if not flag:
                    red.set(f"{self.md5Url}:{key}", json.dumps(self.result_algo[key]))
                    red.expire(f"{self.md5Url}:{key}", cache_expire)
        try:
            sessions.remove(self)
            del self
        except:
            pass



#####################
# Redis interaction #
#####################

def get_session_info(sid):
    return json.loads(red.get(sid).decode())

def status_redis(sid):
    sess_info = get_session_info(sid)

    total = len(sess_info['variations_list'])
    remaining = 0
    complete = total - remaining
    registered = sum([1 for x in sess_info['result_list'].copy() for e in x if not x[e]["NotExist"]])
    return {
        'id': sid,
        'total': total,
        'complete': complete,
        'remaining': remaining,
        'registered': registered,
        'stopped' : sess_info['stopped']
        }

def domains_redis(sid):
    sess_info = get_session_info(sid)
    domain = [x for x in sess_info['result_list'].copy() for e in x if not x[e]["NotExist"]]
    return domain

def dl_domains(sid):
    ## redo to give algo name as key of list
    sess_info = get_session_info(sid)
    result = list()
    for key in algo_list:
        if red.exists(f"{sess_info['md5Url']}:{key}"):
            result.append(red.get(f"{sess_info['md5Url']}:{key}").decode())
    return result

def dl_list(sid):
    sess_info = get_session_info(sid)

    s = ''
    for variation in sess_info["variations_list"]:
        s += variation[0] + '\n'
    return s

def get_algo_from_redis(data_dict, md5Url):
    request_algo = list()
    result_list = dict()

    if 'runAll' in data_dict.keys():
        request_algo = list(algo_list.keys())
    else:
        request_algo = list(data_dict.keys())
        request_algo.remove('url')

    for algo in request_algo:
        if red.exists(f"{md5Url}:{algo}"):
            result_list[algo] = json.loads(red.get(f"{md5Url}:{algo}").decode())
    return result_list



###############
# FLASK ROUTE #
###############

@app.route("/")
def index():
    """Home page"""
    return render_template("home_page.html", algo_list=algo_list, len_table=len(list(algo_list.keys())), keys=list(algo_list.keys()))

@app.route("/info")
def info_page():
    """Info page"""
    return render_template("info.html")

@app.route("/about")
def about_page():
    """About page"""
    return render_template("about.html")


@app.route("/typo", methods=['POST'])
def typo():
    """Run the scan"""
    data_dict = request.json["data_dict"]
    url = data_dict["url"]
    md5Url = hashlib.md5(url.encode()).hexdigest()

    session = Session(url)

    if red.exists(md5Url):
        session.result_stopped = get_algo_from_redis(data_dict, md5Url)

    session.callVariations(data_dict)
    session.scan()
    sessions.append(session)

    return jsonify(session.status()), 201
    

@app.route("/stop/<sid>", methods=['POST'])
def stop(sid):
    """Stop the <sid> queue"""
    for s in sessions:
        if s.id == sid:
            s.stopped = True
            s.stop()
            break
    return jsonify({})


@app.route("/status/<sid>")
def status(sid):
    """Status of <sid> queue"""
    if red.exists(sid):
        return jsonify(status_redis(sid))
    else:
        for s in sessions:
            if s.id == sid:
                return jsonify(s.status())
    return jsonify({'message': 'Scan session not found'}), 404


@app.route("/domains/<sid>")
def domains(sid):
    """Return all accessible domains"""
    if red.exists(sid):
        return jsonify(domains_redis(sid))
    else:
        for s in sessions:
            if s.id == sid:
                return jsonify(s.domains())
    return jsonify({'message': 'Scan session not found'}), 404


@app.route("/download/<sid>/json")
def download_json(sid):
    """Give the result as json format"""
    if red.exists(sid):
        sess_info = get_session_info(sid)
        print(dl_domains(sid))
        return jsonify(dl_domains(sid)), 200, {'Content-Disposition': f'attachment; filename=typo-squatting-{sess_info["url"]}.json'}
    else:
        for s in sessions:
            if s.id == sid:
                return jsonify(s.dl_domains()), 200, {'Content-Disposition': f'attachment; filename=typo-squatting-{s.url}.json'}
    return jsonify({'message': 'Scan session not found'}), 404


@app.route("/download/<sid>/list")
def download_list(sid):
    """Give the list of variations"""
    if red.exists(sid):
        sess_info = get_session_info(sid)
        return dl_list(sid), 200, {'Content-Type': 'text/plain', 'Content-Disposition': f'attachment; filename={sess_info["url"]}-variations.txt'}
    else:
        for s in sessions:
            if s.id == sid:
                return s.dl_list(), 200, {'Content-Type': 'text/plain', 'Content-Disposition': f'attachment; filename={s.url}-variations.txt'}
    return jsonify({'message': 'Scan session not found'}), 404


#########
## API ##
#########

@app.route("/api/<url>", methods=['GET'])
def api(url):
    data_dict = dict(request.args)
    for k in data_dict.keys():
        if k not in algo_list:
            return jsonify({'Algorithm Error': 'The algo you want was not found'}), 400
    session = Session(url)
    session.callVariations(data_dict)
    session.scan()
    sessions.append(session)

    return jsonify({'sid': session.id}), 200


if __name__ == "__main__":
    app.run(host=FLASK_URL, port=FLASK_PORT)
