import os
import re
import json
import redis
import argparse
import configparser


path_config = os.path.join(os.getcwd(), "conf", "conf.cfg")
path_etc = os.path.join(os.getcwd(), "etc", "algo_list.json")
config = ""
algo_list = []
args = ""
sessions = list()

if os.path.isfile(path_config):
    config = configparser.ConfigParser()
    config.read(path_config)
else:
    print("[-] No conf file found")
    exit(-1)


with open("./etc/algo_list.json", "r") as read_json:
    algo_list = json.load(read_json)

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

if 'cache_session' in config:
    cache_expire_session = config['cache_session']['expire']
else:
    cache_expire_session = 86400

if 'cache_session' in config:
    cache_expire_session = config['cache_session']['expire']
else:
    cache_expire_session = 86400



def arg_parse():
    global args
    parser = argparse.ArgumentParser()
    parser.add_argument("-c", "--nocache", help="Disabled caching functionality", action="store_true")
    args = parser.parse_args()

def valid_ns_mx(dns):
    """Regex to validate NS and MX entry"""
    loc_list = list()
    for element in dns.replace(" ", "").split(","):
        if re.search(r"^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-\_]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$", element):
            loc_list.append(element)
    return loc_list