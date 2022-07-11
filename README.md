# ail-typo-website
Website for [ail-typo-squatting](https://github.com/ail-project/ail-typo-squatting) library. This website is strongly inspired by [dnstwist website](https://dnstwist.it).



![ail-typo-website](https://github.com/ail-project/ail-typo-website/blob/main/doc/ail-typo-website.png?raw=true)



## Requirements

- [requests](https://github.com/psf/requests)

- [flask](https://flask.palletsprojects.com/en/2.1.x/)

- [ail-typo-squatting](https://github.com/ail-project/ail-typo-squatting)



## Choice of algorithm

In the `Advanced` option, it's possible to choose algorithms to generate variations from a domain name.

There's 20 algorithms which can be chosen. List can be found [here](https://github.com/ail-project/ail-typo-squatting#list-of-algorithms-used).

## Download part

After a scan, the list of variations can be download to be reused, and also the result can be download to JSON format. 



## API

First, you need to get your *sid* passing the address you want to analyse:

~~~
curl http://localhost:7006/scan/<url>
~~~

Second, result from dns check can be obtain using:

~~~
curl http://localhost:7006/domains/<sid>
~~~



### Output

~~~json
[
{"circl.lu":{"A":["185.194.93.14"],"AAAA":["2a00:5980:93::14"],"MX":["10 cppy.circl.lu."],"NS":["ns3.eurodns.com.",...],"NotExist":false,"geoip":"Luxembourg"}}, ...
{"complete":1535,"id":"3322fa4f-52a0-43cb-a057-22bc07bdde01","registered":2,"remaining":4372,"total":5907} 
]
~~~

The status of the current scan can be found at the end of the json output with : 

`complete`: Number of variations check

`id`: id of the current scan

`registered`: Number of variations which can be accessible with dns

`remaining`: Number of variations  to check to finish the scan

`total`: Number of variations generated

