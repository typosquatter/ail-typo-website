from flask import Flask, jsonify
from flask_restx import Api, Resource

import requests

app = Flask(__name__)
api = Api(app)

FLASK_PORT = 7006
FLASK_URL = "127.0.0.1"

def getStatus(sid):
    return requests.get(f'http://localhost:7005/status/{sid}').json()

@api.route('/domains/<sid>')
class Domains(Resource):
    def get(self, sid):
        domain = requests.get(f'http://localhost:7005/domains/{sid}').json()
        status = getStatus(sid)
        
        if not type(domain) == dict:
            domain.append(status)

        return jsonify(domain)

@api.route('/scan/<url>')
class ScanUrl(Resource):
    def get(self, url):
        r = requests.get(f'http://localhost:7005/api/{url}')

        if r.status_code == 200:
            sid = r.json()['sid']
            return sid
            
        return(r.json()['message'])


if __name__ == "__main__":
    app.run(host=FLASK_URL, port=FLASK_PORT)
