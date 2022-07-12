from flask import Flask, jsonify
from flask_restx import Api, Resource

import os
import configparser
import requests

import idna

pathConf = './conf/conf.cfg'

if os.path.isfile(pathConf):
    config = configparser.ConfigParser()
    config.read(pathConf)
else:
    print("[-] No conf file found")
    exit(-1)

if 'Flask_api' in config:
    FLASK_PORT = int(config['Flask_api']['port'])
    FLASK_URL = config['Flask_api']['ip']
else:
    FLASK_PORT = '127.0.0.1'
    FLASK_URL = 7006

if 'Flask_server' in config:
    FLASK_PORT_SERVER = int(config['Flask_server']['port'])
    FLASK_URL_SERVER = config['Flask_server']['ip']
else:
    FLASK_PORT_SERVER = '127.0.0.1'
    FLASK_URL_SERVER = 7005


app = Flask(__name__)
app.config["DEBUG"] = True

api = Api(
        app, 
        title='ail-typo-squatting API', 
        description='API to submit domain and query a ail-typo-squatting instance.', 
        version='0.1', 
        default='GenericAPI', 
        default_label='Generic ail-typo-squatting API', 
        doc='/doc/'
    )


def getStatus(sid):
    """Get the status of the <sid> scan"""
    return requests.get(f'http://{FLASK_URL_SERVER}:{FLASK_PORT_SERVER}/status/{sid}').json()

def checkDomain(url):
    """Check if the domain is valid"""
    try:
        _ = idna.decode(url)
    except Exception:
        return False
    else:
        return True


@api.route('/domains/<sid>')
@api.doc(description='Request instance to get domain result and current status of the queue', params={'sid': 'id of the scan'})
class Domains(Resource):
    def get(self, sid):
        domain = requests.get(f'http://{FLASK_URL_SERVER}:{FLASK_PORT_SERVER}/domains/{sid}').json()
        status = getStatus(sid)
        
        if not type(domain) == dict:
            domain.append(status)

        return jsonify(domain)

@api.route('/scan/<url>')
@api.doc(description='Request instance to scan a domain', params={'url': 'url to scan'})
class ScanUrl(Resource):
    def get(self, url):
        if checkDomain(url):
            r = requests.get(f'http://{FLASK_URL_SERVER}:{FLASK_PORT_SERVER}/api/{url}')

            if r.status_code == 200:
                sid = r.json()['sid']
                return sid
            
            return r.json()['message']
        return 'Domain not valid'


if __name__ == "__main__":
    app.run(host=FLASK_URL, port=FLASK_PORT)
