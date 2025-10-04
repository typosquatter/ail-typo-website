import json
import math
import hashlib
from uuid import uuid4
from bs4 import BeautifulSoup
from datetime import datetime

import requests
import urllib3
from urllib3.exceptions import InsecureRequestWarning
urllib3.disable_warnings(InsecureRequestWarning)

from queue import Queue
from threading import Thread

import ail_typo_squatting

from similarius import get_website, extract_text_ressource, sk_similarity, ressource_difference, ratio

from .utils import config, algo_list, sessions, red, cache_expire_session, valid_ns_mx
from .warning_list import check_warning_list


if 'Thread' in config:
    num_threads = int(config['Thread']['num_threads'])
else:
    num_threads = 10


if 'cache' in config:
    cache_expire = config['cache']['expire']
else:
    cache_expire = 86400

if "Flask_server" in config:
    if 'sk_similarity' not in config['Flask_server']:
        sk_similarity_bool = False
    else:
        sk_similarity_bool = config.getboolean('Flask_server', 'sk_similarity')
else:
    sk_similarity_bool = False


#################
# Warning lists #
#################


class Session():
    def __init__(self, url, request_files, data_dict):
        """Constructor"""
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
        self.request_algo = list()
        self.catch_all = False
        self.use_cache = True

        self.result_algo = dict()
        for key in list(algo_list.keys()):
            self.result_algo[key] = []
        self.result_algo['original'] = []

        self.md5Url = hashlib.md5(url.encode()).hexdigest()

        self.website = ""
        self.website_ressource = dict()

        self.list_ns = list()
        self.list_mx = list()
        self.list_domains_exclude = list()

        if "file_1" in request_files:
            self.list_domains_exclude = request_files["file_1"].read().decode().splitlines()

        if "catchAll" in data_dict:
            self.catch_all = True

        if 'NS' in data_dict:
            if data_dict['NS'].rstrip():
                self.list_ns = valid_ns_mx(data_dict['NS'])

        if 'MX' in data_dict:
            if data_dict['MX'].rstrip():
                self.list_mx = valid_ns_mx(data_dict['MX'])
            
        if 'use_cache' in data_dict:
            self.use_cache = False


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

    def get_original_website_info(self):
        """Get website ressource of request domain"""

        data = ail_typo_squatting.dnsResolving([self.url], self.url, "", catch_all=self.catch_all)

        response = get_website(self.url)
        if not response:
            self.website, self.website_ressource = extract_text_ressource("")
        else:
            self.website, self.website_ressource = extract_text_ressource(response.text)
            if "200" in str(response) or "401" in str(response):
                soup = BeautifulSoup(response.text, "html.parser")
                title = soup.find_all('title', limit=1)

                # Website has a title
                if title:
                    t = str(title[0])
                    t = t[7:]
                    t = t[:-8]
                    data[self.url]['website_title'] = t
        
        data[self.url]['website_sim'] = "100"
        data[self.url]['ressource_diff'] = "0"
        data[self.url]['ratio'] = 100

        data_keys = list(data[self.url].keys())

        if 'A' in data_keys:
            data[self.url]['geoip'] = self.geoIp(data[self.url]['A'][0])
        elif 'AAAA' in data_keys:
            data[self.url]['geoip'] = self.geoIp(data[self.url]['AAAA'][0]) 

        if 'MX' in data_keys:
            # Parse NS record to remove end point
            for i in range(0, len(data[self.url]['MX'])):
                data[self.url]['MX'][i] = data[self.url]['MX'][i][:-1]

        if 'NS' in data_keys:
            # Parse NS record to remove end point
            for i in range(0, len(data[self.url]['NS'])):
                data[self.url]['NS'][i] = data[self.url]['NS'][i][:-1]

        data[self.url]['variation'] = "original"

        self.result[0] = data
        self.result_algo["original"].append(data)


    def get_website_info(self, variation):
        """Get all info on variation's website and compare it to orginal one."""
        website_info = dict()
        website_info["title"] = ""
        website_info["sim"] = ""
        website_info["diff_score"] = ""
        website_info["ratio"] = ""

        response = get_website(variation)
        if response:
            # Variation has a website
            if "200" in str(response) or "401" in str(response):
                soup = BeautifulSoup(response.text, "html.parser")
                title = soup.find_all('title', limit=1)

                # Website has a title
                if title:
                    t = str(title[0])
                    t = t[7:]
                    t = t[:-8]
                    website_info["title"] = t

                # Get the text only and ressources
                text, ressource_dict = extract_text_ressource(response.text)

                if text and self.website:
                    if sk_similarity_bool:
                        sim = str(sk_similarity(self.website, text))
                        website_info['sim'] = sim
                    
                    # Ressources difference between original's website and varation one
                    ressource_diff = ressource_difference(self.website_ressource, ressource_dict)

                    website_info['ressource_diff'] = ressource_diff
                    
                    # Ratio to calculate the similarity probability
                    if sk_similarity_bool:
                        website_info['ratio'] = ratio(ressource_diff, sim)

        return website_info


    def crawl(self):
        """Threaded function for queue processing."""
        while not self.jobs.empty():
            work = self.jobs.get()   #fetch new work from the Queue
            try:
                flag = False
                ## If redis have some domains cached, don't resolve it again
                if self.result_stopped and not cache_expire == 0 and self.use_cache:
                    if work[1][1] in list(self.result_stopped.keys()):
                        for domain in self.result_stopped[work[1][1]]:
                            if list(domain.keys())[0] == work[1][0]:
                                data = domain
                                data = check_warning_list(data, work)
                                flag = True
                
                ## Redis doesn't have this domain in is db
                if not flag:
                    data = ail_typo_squatting.dnsResolving([work[1][0]], self.url, "", catch_all=self.catch_all)

                    # Compare original and current variation website
                    website_info = self.get_website_info(work[1][0])

                    if "sim" in website_info:
                        data[work[1][0]]['website_sim'] = website_info["sim"]
                    if "title" in website_info:
                        data[work[1][0]]['website_title'] = website_info["title"]
                    if "ressource_diff" in website_info:
                        data[work[1][0]]['ressource_diff'] = website_info["ressource_diff"]
                    if "ratio" in website_info:
                        data[work[1][0]]['ratio'] = website_info["ratio"]

                    data_keys = list(data[work[1][0]].keys())

                    if 'A' in data_keys:
                        data[work[1][0]]['geoip'] = self.geoIp(data[work[1][0]]['A'][0])
                    elif 'AAAA' in data_keys:
                        data[work[1][0]]['geoip'] = self.geoIp(data[work[1][0]]['AAAA'][0])  


                    if 'MX' in data_keys:
                        # Parse NS record to remove end point
                        for i in range(0, len(data[work[1][0]]['MX'])):
                            data[work[1][0]]['MX'][i] = data[work[1][0]]['MX'][i][:-1]
                            # Mark variation if present in MX list
                            for mx in self.list_mx:
                                if data[work[1][0]]['MX'][i].split(" ")[1] in mx:
                                    data[work[1][0]]['mx_identified'] = True
                                    break

                    if 'NS' in data_keys:
                        # Parse NS record to remove end point
                        for i in range(0, len(data[work[1][0]]['NS'])):
                            data[work[1][0]]['NS'][i] = data[work[1][0]]['NS'][i][:-1]
                            # Mark variation if present in NS list
                            for ns in self.list_ns:
                                if data[work[1][0]]['NS'][i] in ns:
                                    data[work[1][0]]['ns_identified'] = True
                                    break

                    data[work[1][0]]['variation'] = work[1][1]
                    self.add_data = True

                    data = check_warning_list(data, work)

                    if self.list_domains_exclude:
                        if work[1][0] in self.list_domains_exclude:
                            data[work[1][0]]['exclude_domain'] = True

                self.result[work[0] + 1] = data         #Store data back at correct index
                self.result_algo[work[1][1]].append(data)
            except Exception as e:
                bad_result = dict()
                bad_result[work[1][0]] = {"NotExist":True}
                self.result[work[0] + 1] = bad_result
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
            worker.join(3.5)

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
            self.catch_all = True
            self.request_algo = list(algo_list.keys())
            for key in self.request_algo:
                if not key == "addDynamicDns":
                    fun = getattr(ail_typo_squatting, key)
                    self.variations_list = fun(self.url, self.variations_list, verbose=False, limit=math.inf, givevariations=True, keeporiginal=False)

        else:
            for key in all_keys:
                if key in list(algo_list.keys()):
                    self.request_algo.append(key)
                    fun = getattr(ail_typo_squatting, key)
                    self.variations_list = fun(self.url, self.variations_list, verbose=False, limit=math.inf, givevariations=True, keeporiginal=False)

        self.result = [{} for x in self.variations_list]
        self.result.append({})
        self.get_original_website_info()

    def dl_list(self):
        """list of variations to string"""
        s = ''
        for variation in self.variations_list:
            s += variation[0] + '\n'
        return s
        
    def saveInfo(self):
        """Save session info to redis"""
        saveInfo = dict()
        saveInfo['url'] = self.url
        saveInfo['result_list'] = self.result
        saveInfo['variations_list'] = self.variations_list
        saveInfo['stopped'] = self.stopped
        saveInfo['md5Url'] = self.md5Url
        saveInfo['request_algo'] = self.request_algo
        saveInfo['request_date'] = datetime.now().strftime("%Y-%m-%d %H-%M")

        red.set(self.id, json.dumps(saveInfo))
        red.expire(self.id, cache_expire_session)
        red.set(self.md5Url, 1)
        red.expire(self.md5Url, cache_expire)

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