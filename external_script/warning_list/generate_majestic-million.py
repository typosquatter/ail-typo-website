#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from generator import download_to_file, get_abspath_source_file
import argparse
import configparser
import os
import redis

pathConf = '../../conf/conf.cfg'

if os.path.isfile(pathConf):
    config = configparser.ConfigParser()
    config.read(pathConf)
else:
    print("[-] No conf file found")
    exit(-1)

if 'redis_warning_list' in config:
    red = redis.Redis(host=config['redis_warning_list']['host'], port=config['redis_warning_list']['port'], db=config['redis_warning_list']['db'])
else:
    red = redis.Redis(host='localhost', port=6379, db=2)


def process(file, numbers):

    with open(get_abspath_source_file(file), newline='\n', encoding='utf-8', errors='replace') as csv_file:
        sites = csv_file.readlines()[1:numbers]

    for site in sites:
        v = site.split(',')[2]
        red.zadd('majestic_million', {v.rstrip(): 1})


if __name__ == '__main__':

    parser = argparse.ArgumentParser()
    parser.add_argument("-n", help="number of website to process", required=True)
    args = parser.parse_args()

    majestic_url = 'http://downloads.majestic.com/majestic_million.csv'
    majestic_file = 'majestic_million.csv'

    download_to_file(majestic_url, majestic_file)
    process(majestic_file, int(args.n))
