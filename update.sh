#!/bin/bash

source env/bin/activate
pip install -r requirements.txt
python external_script/warning_list/generate_warning_list.py
deactivate