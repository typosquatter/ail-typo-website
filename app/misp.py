import json
from pymisp import MISPEvent, MISPObject, MISPOrganisation
from typing import List

from .redis_interaction import *
from .utils import red, cache_expire_session


def create_misp_event(sid):
    """Create a MISP event for MISP feed"""
    sess_info = get_session_info(sid)

    org = MISPOrganisation()
    org.name = "typosquatting-finder.circl.lu"
    org.uuid = "8df15512-0314-4c2a-bd00-9334ab9b59e6"

    event = MISPEvent()
    event.uuid = sid

    event.info = f"Typosquatting for: {sess_info['url']}"  # Required
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
    sess_info = get_session_info(sid)
    domain_identified = domains_redis(sid)

    misp_object = MISPObject('typosquatting-finder', standalone=False)
    qname = misp_object.add_attribute('research-domain', value=sess_info['url'])
    qname.add_tag({'name': "typosquatting:research", 'colour': "#00730d"})
    misp_object.add_attribute('variations-number', value=len(sess_info["result_list"]))
    misp_object.add_attribute('variations-found-number', value=len(domain_identified))
    event.add_object(misp_object)

    for algo in result_list:
        for i in range(0, len(result_list[algo])):
            for domain in result_list[algo][i]:
                misp_object = MISPObject('typosquatting-finder-result', standalone=False)
                qname = misp_object.add_attribute('queried-domain', value=domain)
                qname.add_tag({'name': f"typosquatting:{algo}", 'colour': "#e68b48"})

                if 'A' in result_list[algo][i][domain]:
                    for a in result_list[algo][i][domain]['A']:
                        misp_object.add_attribute('a-record', value=a)
                if 'AAAA' in result_list[algo][i][domain]:
                    for aaaa in result_list[algo][i][domain]['AAAA']:
                        misp_object.add_attribute('aaaa-record', value=aaaa)
                if 'MX' in result_list[algo][i][domain]:
                    for mx in result_list[algo][i][domain]['MX']:
                        misp_object.add_attribute('mx-record', value=mx)
                if 'NS' in result_list[algo][i][domain]:
                    for ns in result_list[algo][i][domain]['NS']:
                        misp_object.add_attribute('ns-record', value=ns)

                if "website_title" in result_list[algo][i][domain] and result_list[algo][i][domain]["website_title"]:
                    misp_object.add_attribute('website-title', value=result_list[algo][i][domain]["website_title"])

                if "website_sim" in result_list[algo][i][domain] and result_list[algo][i][domain]["website_sim"]:
                    misp_object.add_attribute('website-similarity', value=result_list[algo][i][domain]["website_sim"])

                if "ressource_diff" in result_list[algo][i][domain] and result_list[algo][i][domain]["ressource_diff"]:
                    misp_object.add_attribute('website-ressource-diff', value=result_list[algo][i][domain]["ressource_diff"])

                if "ratio" in result_list[algo][i][domain] and result_list[algo][i][domain]["ratio"]:
                    misp_object.add_attribute('ratio-similarity', value=result_list[algo][i][domain]["ratio"])

                event.add_object(misp_object)

    feed_event = event.to_feed()

    if store:
        red.set(f"event_json:{sid}", json.dumps(feed_event))
        red.expire(f"event_json:{sid}", cache_expire_session) # 1h

        return event
        
    return feed_event
