import json
from .utils import redis_warning_list


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

if redis_warning_list.exists('google_crux'):
    google_crux = True
else:
    google_crux = False



def check_warning_list(data, work):
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
    if google_crux:
        if redis_warning_list.zrank('google_crux', work[1][0]) != None:
            data[work[1][0]]['google_crux'] = True

    return data