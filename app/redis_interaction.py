import json
from datetime import datetime

from .utils import red, red_user, algo_list

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