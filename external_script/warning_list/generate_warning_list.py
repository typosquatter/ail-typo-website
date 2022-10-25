import os
import requests
import redis
import configparser
import subprocess
import json

pathConf = '../../conf/conf.cfg'

if os.path.isfile(pathConf):
    config = configparser.ConfigParser()
    config.read(pathConf)
else:
    print("[-] No conf file found")
    exit(-1)

if 'redis_warning_list' in config:
    redis_warning_list = redis.Redis(host=config['redis_warning_list']['host'], port=config['redis_warning_list']['port'], db=config['redis_warning_list']['db'])
else:
    redis_warning_list = redis.Redis(host='localhost', port=6379, db=2)


print("[+] Bank Website\n")
try:
    r = requests.get("https://raw.githubusercontent.com/MISP/misp-warninglists/main/lists/bank-website/list.json")
    for bank in r.json()['list']:
        redis_warning_list.zadd("bank_website", {bank[1:]: 1})
except:
    print("[-] Error Download bank-website")


print("[+] University domains\n")
try:
    r = requests.get("https://raw.githubusercontent.com/MISP/misp-warninglists/main/lists/university_domains/list.json")
    for univ in r.json()['list']:
        redis_warning_list.zadd("university_domains", {univ: 1})
except:
    print("[-] Error Download university-domains")


print("[+] Parking domains\n")
try:
    r = requests.get("https://raw.githubusercontent.com/MISP/misp-warninglists/main/lists/parking-domain/list.json")
    for park_domain in r.json()['list']:
        redis_warning_list.zadd("parking_domains", {park_domain: 1})
except:
    print("[-] Error Download parking_domains")

print("[+] Parking domains NS\n")
try:
    r = requests.get("https://raw.githubusercontent.com/MISP/misp-warninglists/main/lists/parking-domain-ns/list.json")
    redis_warning_list.set("parking_domains_ns", json.dumps(r.json()['list']))
except:
    print("[-] Error Download parking_domains_ns")


print("[+] Tranco\n")
try:
    r = requests.get("https://raw.githubusercontent.com/MISP/misp-warninglists/main/lists/tranco/list.json")
    for tranco in r.json()['list']:
        redis_warning_list.zadd("tranco", {tranco: 1})
except:
    print("[-] Error Download tranco")

print("[+] Moz-top500\n")
try:
    r = requests.get("https://raw.githubusercontent.com/MISP/misp-warninglists/main/lists/moz-top500/list.json")
    for moz in r.json()['list']:
        redis_warning_list.zadd("moz-top500", {moz: 1})
except:
    print("[-] Error Download mos-top500")

print("[+] Majestic Million")
subprocess.call(['python3', 'generate_majestic-million.py', '-n', '1000000'])