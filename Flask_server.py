from flask import Flask, render_template, url_for, request, jsonify
import ail_typo_squatting
import math
from uuid import uuid4
import configparser
import argparse
import os
import json
import redis
import hashlib
from datetime import datetime
import re

from typing import List

import requests
from requests.packages.urllib3.exceptions import InsecureRequestWarning
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

from queue import Queue
from threading import Thread

from pymisp import MISPEvent, MISPObject, MISPOrganisation

import tldextract

from bs4 import BeautifulSoup
from bs4.element import Comment

import urllib3


from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.feature_extraction import text

import gensim
import nltk
import numpy as np
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import stopwords
import string
nltk.download('punkt')
nltk.download('stopwords')


#############
# Arg Parse #
#############

parser = argparse.ArgumentParser()
parser.add_argument("-c", "--nocache", help="Disabled caching functionality", action="store_true")
args = parser.parse_args()


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
    red = redis.Redis(host='localhost', port=6379, db=0)

if 'redis_user' in config:
    red_user = redis.Redis(host=config['redis_user']['host'], port=config['redis_user']['port'], db=config['redis_user']['db'])
else:
    red_user = redis.Redis(host='localhost', port=6379, db=1)

if 'redis_warning_list' in config:
    redis_warning_list = redis.Redis(host=config['redis_warning_list']['host'], port=config['redis_warning_list']['port'], db=config['redis_warning_list']['db'])
else:
    redis_warning_list = redis.Redis(host='localhost', port=6379, db=2)

if not args.nocache:
    if 'cache' in config:
        cache_expire = config['cache']['expire']
    else:
        cache_expire = 86400
else:
    cache_expire = 0

if 'cache_session' in config:
    cache_expire_session = config['cache_session']['expire']
else:
    cache_expire_session = 3600


sessions = list()

with open("./etc/algo_list.json", "r") as read_json:
    algo_list = json.load(read_json)

#################
# Warning lists #
#################

if redis_warning_list.exists('majestic_million'):
    majestic_million = True
else:
    majestic_million = False

if redis_warning_list.exists('university_domains'):
    university = True
else:
    university = False

if redis_warning_list.exists('bank_website'):
    bank_website = True
else:
    bank_website = False

if redis_warning_list.exists('parking_domains'):
    parking_domain = True
else:
    parking_domain = False

if redis_warning_list.exists('parking_domains_ns'):
    parking_domain_ns = json.loads(redis_warning_list.get("parking_domains_ns").decode())
else:
    parking_domain_ns = False

if redis_warning_list.exists('tranco'):
    tranco = True
else:
    tranco = False

if redis_warning_list.exists('moz-top500'):
    moz_top500 = True
else:
    moz_top500 = False

#########
## APP ##
#########

app = Flask(__name__)
# app.debug = True
app.config['JSONIFY_PRETTYPRINT_REGULAR'] = True

###############
# Similarity #
##############

stop_words = set(stopwords.words('english') + list(string.punctuation))

def similarity(original_website, variation_website):
    """Similiarity between original website and variation's one"""
    file_docs = []
    file2_docs = []
    avg_sims = []

    tokens = sent_tokenize(original_website)
    for line in tokens:
        file_docs.append(line)

    gen_docs = [[w for w in word_tokenize(text.lower()) if w not in stop_words] 
                for text in file_docs]

    dictionary = gensim.corpora.Dictionary(gen_docs)
    corpus = [dictionary.doc2bow(gen_doc) for gen_doc in gen_docs]
    tf_idf = gensim.models.TfidfModel(corpus)
    sims = gensim.similarities.Similarity('./',tf_idf[corpus], num_features=len(dictionary))

    tokens = sent_tokenize(variation_website)
    for line in tokens:
        file2_docs.append(line)
            
    for line in file2_docs:
        query_doc = [w for w in word_tokenize(line.lower()) if w not in stop_words]
        query_doc_bow = dictionary.doc2bow(query_doc)
        query_doc_tf_idf = tf_idf[query_doc_bow]
        sum_of_sims = 0
        sum_of_sims = np.sum(sims[query_doc_tf_idf], dtype=np.float32)
        avg = sum_of_sims / len(file_docs)
        avg_sims.append(avg)

    total_avg = np.sum(avg_sims, dtype=np.float32)
    percentage_of_similarity = round(float(total_avg) * 100)
    
    if percentage_of_similarity >= 100:
        percentage_of_similarity = 100

    return percentage_of_similarity


ENGLISH_STOP_WORDS = set( stopwords.words('english') ).union( set(text.ENGLISH_STOP_WORDS) ).union(set(string.punctuation))

def sk_similarity(doc1, doc2):
    vectorizer = TfidfVectorizer(stop_words=list(ENGLISH_STOP_WORDS), max_features=5000)
    tfidf = vectorizer.fit_transform([doc1, doc2])

    return round(((tfidf * tfidf.T).toarray())[0,1] * 100)


##################
# Web treatment #
#################

def tag_visible(element):
    """Identified element present in specific balise"""
    if element.parent.name in ['style', 'script', 'head', 'title', 'meta', '[document]']:
        return False
    if isinstance(element, Comment):
        return False
    return True


def text_from_html(body):
    """Extract text from web page and remove text present in specific balise"""
    soup = BeautifulSoup(body, 'html.parser')
    texts = soup.findAll(text=True)
    visible_texts = filter(tag_visible, texts)  
    return u" \n".join(t.strip() for t in visible_texts)


def find_list_resources(tag, attribute, soup):
    """Find ressource in web page list in attribute"""
    list = []
    for x in soup.findAll(tag):
        try:
            list.append(x[attribute])
        except KeyError:
            pass
    return(list)



class Session():
    def __init__(self, url):
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

        self.result_algo = dict()
        for key in list(algo_list.keys()):
            self.result_algo[key] = []
        self.result_algo['original'] = []

        self.md5Url = hashlib.md5(url.encode()).hexdigest()

        self.website = ""
        self.website_ressource = dict()

        self.get_original_website_info()

        self.list_ns = list()
        self.list_mx = list()


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
        url = f"http://{self.url}"
        response = requests.get(url, verify=False, timeout=3)
        soup = BeautifulSoup(response.text, "html.parser")

        self.website_ressource["image_scr"] = find_list_resources('img',"src",soup)   
        self.website_ressource["script_src"] = find_list_resources('script',"src",soup)    
        self.website_ressource["css_link"] = find_list_resources("link","href",soup)        
        self.website_ressource["source_src"] = find_list_resources("source","src",soup) 
        self.website_ressource["a_href"] = find_list_resources("a","href",soup) 

        self.website = text_from_html(response.text)

    def get_website_info(self, variation):
        """Get all info on variation's website and compare it to orginal one."""
        website_info = dict()
        website_info["title"] = ""
        website_info["sim"] = ""
        website_info["diff_score"] = ""
        website_info["ratio"] = ""

        try:
            url = f"http://{variation}"
            response = requests.get(url, verify=False, timeout=3)

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

                # Get the text only
                text = text_from_html(response.text)

                if text and self.website:
                    # sim = str(similarity(self.website, text))
                    sim = str(sk_similarity(self.website, text))
                    website_info['sim'] = sim
                    
                    # Extract ressources
                    ressource_dict = dict()
                    ressource_dict["image_scr"] = find_list_resources('img',"src",soup)   
                    ressource_dict["script_src"] = find_list_resources('script',"src",soup)    
                    ressource_dict["css_link"] = find_list_resources("link","href",soup)        
                    ressource_dict["source_src"] = find_list_resources("source","src",soup) 
                    ressource_dict["a_href"] = find_list_resources("a","href",soup) 

                    # Ressources difference between original's website and varation one
                    cp_total = 0
                    cp_diff = 0

                    for r_to_check in self.website_ressource:
                        for r in self.website_ressource[r_to_check]:
                            cp_total += 1
                            if r_to_check in ressource_dict:
                                if r not in ressource_dict[r_to_check]:
                                    cp_diff += 1

                    ressource_diff = str(int((cp_diff/cp_total)*100))

                    website_info['ressource_diff'] = ressource_diff
                    
                    # Ratio to calculate the similarity probability
                    if int(ressource_diff) != 0:
                        if int(ressource_diff) < int(sim):
                            ratio = round((int(ressource_diff)/int(sim))*int(ressource_diff), 2)
                        else:
                            ratio = round((int(sim)/int(ressource_diff))*int(sim), 2)
                    elif int(sim) == 100:
                        ratio = 0.05
                    else:
                        ratio = 0.5

                    website_info['ratio'] = ratio

                    # return sim, t, diff_score, ratio
                    return website_info
                return website_info
        except urllib3.exceptions.NewConnectionError:
            return website_info
        except requests.exceptions.ConnectionError:
            return website_info
        except urllib3.exceptions.ReadTimeoutError:
            return website_info
        except Exception as e :
            # import traceback
            # traceback.print_exception(type(e), e, e.__traceback__)
            return website_info


    def check_warning_list(self, data, work):
        """Mark variations present in warning lists"""
        flag_parking = False
        data_keys = list(data[work[1][0]].keys())

        if majestic_million:
            if redis_warning_list.zrank('majestic_million', work[1][0]) != None:
                data[work[1][0]]['majestic_million'] = True
        if parking_domain:
            if 'A' in data_keys:
                for a in data[work[1][0]]['A']:
                    if redis_warning_list.zrank('parking_domains', a) != None:
                        data[work[1][0]]['parking_domains'] = True
                        data[work[1][0]]['park_ip'] = True
                        flag_parking = True
                        break
        if university:
            if redis_warning_list.zrank("university_domains", work[1][0]) != None:
                data[work[1][0]]['university_domains'] = True
        if bank_website:
            if redis_warning_list.zrank("bank_domains", work[1][0]) != None:
                data[work[1][0]]['bank_domains'] = True
        if parking_domain_ns and not flag_parking:
            if 'NS' in data_keys:
                for ns in data[work[1][0]]['NS']:
                    for park in parking_domain_ns:
                        if park in ns.lower():
                            data[work[1][0]]['parking_domains'] = True
                            break
        if tranco:
            if redis_warning_list.zrank('tranco', work[1][0]) != None:
                data[work[1][0]]['tranco'] = True
        if moz_top500:
            if redis_warning_list.zrank('moz-top500', work[1][0]) != None:
                data[work[1][0]]['moz-top500'] = True

        return data


    def crawl(self):
        """Threaded function for queue processing."""
        while not self.jobs.empty():
            work = self.jobs.get()   #fetch new work from the Queue
            try:
                flag = False
                ## If redis have some domains cached, don't resolve it again
                if self.result_stopped and not args.nocache:
                    if work[1][1] in list(self.result_stopped.keys()):
                        for domain in self.result_stopped[work[1][1]]:
                            if list(domain.keys())[0] == work[1][0]:
                                data = domain
                                data = self.check_warning_list(data, work)
                                flag = True

                ## Redis doesn't have this domain in is db
                if not flag:
                    if app.debug:
                        data = ail_typo_squatting.dnsResolving([work[1][0]], self.url, "-", verbose=True)
                    else:
                        data = ail_typo_squatting.dnsResolving([work[1][0]], self.url, "")

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

                    data = self.check_warning_list(data, work)

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
            self.request_algo = list(algo_list.keys())
            self.variations_list = ail_typo_squatting.runAll(self.url, math.inf, 'text', "", verbose=False, givevariations=True, keeporiginal=True)
        else:
            for key in all_keys:
                if key in list(algo_list.keys()):
                    self.request_algo.append(key)
                    fun = getattr(ail_typo_squatting, key)
                    self.variations_list = fun(self.url, self.variations_list, verbose=False, limit=math.inf, givevariations=True, keeporiginal=True)

        self.result = [{} for x in self.variations_list]

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


##########
## MISP ##
##########

def create_misp_event(sid):
    """Create a MISP event for MISP feed"""
    sess_info = get_session_info(sid)

    org = MISPOrganisation()
    org.name = "typosquatting-finder.circl.lu"
    org.uuid = "8df15512-0314-4c2a-bd00-9334ab9b59e6"

    event = MISPEvent()

    event.info = sess_info['url']  # Required
    event.distribution = 0  # Optional, defaults to MISP.default_event_distribution in MISP config
    event.threat_level_id = 4  # Optional, defaults to MISP.default_event_threat_level in MISP config
    event.analysis = 2  # Optional, defaults to 0 (initial analysis)
    event.Orgc = org

    return event


def feed_meta_generator(event, sid):
    """Generate MISP feed manifest"""
    manifests = {}
    hashes: List[str] = []

    manifests.update(event.manifest)
    hashes += [f'{h},{event.uuid}' for h in event.attributes_hashes('md5')]

    red.set(f"event_manifest:{sid}", json.dumps(manifests))
    red.set(f"event_hashes:{sid}", json.dumps(hashes))

    red.expire(f"event_manifest:{sid}", cache_expire_session)
    red.expire(f"event_hashes:{sid}", cache_expire_session)


def dl_misp_feed(sid, store=True):
    """Generate MISP feed to download"""
    event = create_misp_event(sid)
    result_list = dl_domains(sid)

    misp_object = MISPObject('dns-record', standalone=False)

    for algo in result_list:
        for i in range(0, len(result_list[algo])):
            for domain in result_list[algo][i]:
                misp_object = MISPObject('dns-record', standalone=False)
                qname = misp_object.add_attribute('queried-domain', value=domain)
                qname.add_tag({'name': f"typosquatting:{algo}", 'colour': "#e68b48"})

                if 'A' in result_list[algo][i][domain].keys():
                    for a in result_list[algo][i][domain]['A']:
                        misp_object.add_attribute('a-record', value=a)
                if 'AAAA' in result_list[algo][i][domain].keys():
                    for aaaa in result_list[algo][i][domain]['AAAA']:
                        misp_object.add_attribute('aaaa-record', value=aaaa)
                if 'MX' in result_list[algo][i][domain].keys():
                    for mx in result_list[algo][i][domain]['MX']:
                        misp_object.add_attribute('mx-record', value=mx)
                if 'NS' in result_list[algo][i][domain].keys():
                    for ns in result_list[algo][i][domain]['NS']:
                        misp_object.add_attribute('ns-record', value=ns)

                event.add_object(misp_object)

    feed_event = event.to_feed()

    if store:
        red.set(f"event_json:{sid}", json.dumps(feed_event))
        red.expire(f"event_json:{sid}", cache_expire_session) # 1h

        return event
        
    return feed_event



#####################
# Redis interaction #
#####################

def get_session_info(sid):
    """Get session info from redis"""
    return json.loads(red.get(sid).decode())

def status_redis(sid):
    """Get session status from redis"""
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
    """Get identified domains list from redis"""
    sess_info = get_session_info(sid)
    domain = [x for x in sess_info['result_list'].copy() for e in x if not x[e]["NotExist"]]
    return domain

def dl_domains(sid):
    """Get identified domains list from redis to download"""
    sess_info = get_session_info(sid)
    request_algo = sess_info["request_algo"]
    request_algo.insert(0, 'original')
    result = dict()
    for key in request_algo:
        if red.exists(f"{sess_info['md5Url']}:{key}"):
            result[key] = list()
            loc_list = json.loads(red.get(f"{sess_info['md5Url']}:{key}").decode())

            for x in loc_list:
                for e in x:
                    if not x[e]["NotExist"]:
                        result[key].append(x)

            if not result[key]:
                del result[key]

    return result

def dl_list(sid):
    """Get variations list from redis to download"""
    sess_info = get_session_info(sid)

    s = ''
    for variation in sess_info["variations_list"]:
        s += variation[0] + '\n'
    return s


def get_algo_from_redis(data_dict, md5Url):
    """Get resolved domains list from redis"""
    request_algo = list()
    result_list = dict()

    if 'runAll' in data_dict.keys():
        request_algo = list(algo_list.keys())
    else:
        request_algo = list(data_dict.keys())
        request_algo.insert(0, 'original')
        try:
            request_algo.remove('url')
        except:
            pass

    for algo in request_algo:
        if red.exists(f"{md5Url}:{algo}"):
            result_list[algo] = json.loads(red.get(f"{md5Url}:{algo}").decode())
    return result_list


def set_info(domain, request):
    """Set user info to redis"""
    if 'x-forwarded-for' in request.headers:
        ip = request.headers['x-forwarded-for']
    else:
        ip = request.remote_addr
    user_agent = str(request.user_agent)
    now = datetime.now()
    dt_string = now.strftime("%Y/%m/%d %H:%M:%S")

    if red_user.exists(ip):
        current_data = json.loads(red_user.get(ip).decode())
        if not user_agent in current_data['user_agent']:
            current_data['user_agent'].append(user_agent)

        flag = False
        
        for i in range(0, len(current_data['domain'])):
            if domain in list(current_data['domain'][i].keys()):
                current_data['domain'][i][domain] = int(current_data['domain'][i][domain]) + 1
                flag = True
        if not flag:
            current_data['domain'].append({domain: 1})

        current_data['nb_request'] = int(current_data['nb_request']) + 1
        current_data['last_request'] = dt_string

        red_user.set(ip, json.dumps(current_data))
    else:
        export_data = dict()
        export_data['user_agent'] = [user_agent]
        export_data['nb_request'] = 1
        export_data['domain'] = [{domain: 1}]
        export_data['last_request'] = dt_string

        red_user.set(ip, json.dumps(export_data))


def valid_ns_mx(dns):
    """Regex to validate NS and MX entry"""
    loc_list = list()
    for element in dns.replace(" ", "").split(","):
        if re.search(r"^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-\_]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$", element):
            loc_list.append(element)
    return loc_list
    


###############
# FLASK ROUTE #
###############

@app.route("/")
def index():
    """Home page"""
    return render_template("home_page.html", algo_list=algo_list, len_table=len(list(algo_list.keys())), keys=list(algo_list.keys()), share=0)

@app.route("/info")
def info_page():
    """Info page"""
    return render_template("info.html", algo_list=algo_list, len_table=len(list(algo_list.keys())), keys=list(algo_list.keys()))

@app.route("/about")
def about_page():
    """About page"""
    return render_template("about.html")


@app.route("/typo", methods=['POST'])
def typo():
    """Run the scan"""
    data_dict = request.json["data_dict"]
    url = data_dict["url"]

    domain_extract = tldextract.extract(url)
    if domain_extract.suffix:
        url = '.'.join(part for part in domain_extract if part)
    else:
        return jsonify({'message': 'Please enter a valid domain name'}), 400

    set_info(url, request)

    md5Url = hashlib.md5(url.encode()).hexdigest()

    session = Session(url)

    if data_dict['NS'].rstrip():
        session.list_ns = valid_ns_mx(data_dict['NS'])

    if data_dict['MX'].rstrip():
        session.list_mx = valid_ns_mx(data_dict['MX'])

    if red.exists(md5Url):
        session.result_stopped = get_algo_from_redis(data_dict, md5Url)

    session.callVariations(data_dict)
    session.scan()
    sessions.append(session)

    return jsonify(session.status()), 201
    

@app.route("/stop/<sid>", methods=['POST', 'GET'])
def stop(sid):
    """Stop the <sid> queue"""
    for s in sessions:
        if s.id == sid:
            s.stopped = True
            s.stop()
            break
    return jsonify({"Stop": "Successful"}), 200


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

@app.route("/<sid>")
def share(sid):
    """Share a research"""
    return render_template("home_page.html", algo_list=algo_list, len_table=len(list(algo_list.keys())), keys=list(algo_list.keys()), share=sid)

@app.route("/share/<sid>")
def share_info(sid):
    """Get share info from redis"""
    if red.exists(sid):
        sess_info = get_session_info(sid)
        return sess_info['url'], 200
    return jsonify({'message': 'Scan session not found'}), 404


#############
## MISP DL ##
#############

@app.route("/download/<sid>/misp-feed")
def download_misp_feed(sid):
    """Give the list of variations"""
    if red.exists(sid):
        event = dl_misp_feed(sid, store=True)
        feed_meta_generator(event, sid)

        html = f'<a href="/download/{sid}/misp-feed/{event.uuid}.json">{event.uuid}.json</a>'
        html += f'<br /><a href="/download/{sid}/misp-feed/hashes.csv">hashes.csv</a>'
        html += f'<br /><a href="/download/{sid}/misp-feed/manifest.json">manifest.json</a>'

        return html
    return jsonify({"message": "Session not found"}), 404

@app.route("/download/<sid>/misp-feed/<file>")
def download_misp(sid, file):
    """Download a specific MISP feed file"""
    if file == 'hashes.csv':
        return jsonify(json.loads(red.get(f"event_hashes:{sid}").decode())), 200
    elif file == 'manifest.json':
        return jsonify(json.loads(red.get(f"event_manifest:{sid}").decode())), 200
    elif re.match(r"^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$", file.split('.')[0]):
        event = json.loads(red.get(f"event_json:{sid}").decode())
        if file.split('.')[0] == event['Event']['uuid']:
            return jsonify(json.loads(red.get(f"event_json:{sid}").decode())), 200
        else:
            return jsonify({'message': 'File not exist'})
    else:
        return jsonify({'message': 'File not exist'})

@app.route("/download/<sid>/misp-json")
def download_misp_json(sid):
    """Download MISP feed as json format"""
    event = dl_misp_feed(sid, store=False)
    return jsonify(event), 200, {'Content-Disposition': f"attachment; filename={event['Event']['uuid']}.json"}


#########
## API ##
#########

@app.route("/api/<url>", methods=['GET'])
def api(url):
    """Special api route"""
    data_dict = dict(request.args)
    loc_algo_list = list(algo_list.keys())
    loc_algo_list.append("runAll")
    for k in data_dict.keys():
        if k not in loc_algo_list:
            return jsonify({'Algorithm Error': 'The algo you want was not found'}), 400

    md5Url = hashlib.md5(url.encode()).hexdigest()
    session = Session(url)

    if red.exists(md5Url):
        session.result_stopped = get_algo_from_redis(data_dict, md5Url)

    session.callVariations(data_dict)
    session.scan()
    sessions.append(session)

    return jsonify({'sid': session.id}), 200


if __name__ == "__main__":
    app.run(host=FLASK_URL, port=FLASK_PORT)
