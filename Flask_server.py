import re
import json
import hashlib

from flask import Flask, render_template, request, jsonify

import ail_typo_squatting

import tldextract

from app.session import Session
from app.utils import config, sessions, arg_parse
from app.redis_interaction import *
from app.misp import *


#############
# Arg Parse #
#############

arg_parse()

##########
## CONF ##
##########

if 'Flask_server' in config:
    FLASK_PORT = int(config['Flask_server']['port'])
    FLASK_URL = config['Flask_server']['ip']
else:
    FLASK_URL = '127.0.0.1'
    FLASK_PORT = 7005


#########
## APP ##
#########

app = Flask(__name__)
app.debug = True
app.config['JSONIFY_PRETTYPRINT_REGULAR'] = True


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
    data_dict = dict(request.form)
    url = data_dict["url"]    

    domain_extract = tldextract.extract(url)

    res = ail_typo_squatting.check_valid_domain(domain_extract)
    if res:
        return jsonify({'message': res}), 400
    
    if domain_extract.suffix:
        if domain_extract.subdomain:
            url = f"{domain_extract.subdomain}."
        else:
            url = ""
        url += f"{domain_extract.domain}.{domain_extract.suffix}"

    set_info(url, request)

    md5Url = hashlib.md5(url.encode()).hexdigest()

    session = Session(url, request.files, data_dict)

    if red.exists(md5Url):
        session.result_stopped = get_algo_from_redis(data_dict, md5Url)

    session.callVariations(data_dict)
    session.scan()
    sessions.append(session)

    return jsonify(session.status()), 201
    

@app.route("/stop/<sid>", methods=['POST', 'GET'])
def stop(sid):
    """Stop the session queue"""
    for s in sessions:
        if s.id == sid:
            s.stopped = True
            s.stop()
            break
    return jsonify({"Stop": "Successful"}), 200


@app.route("/status/<sid>")
def status(sid):
    """Status of session queue"""
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
