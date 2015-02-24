#!/usr/bin/python

# Check GTFS feeds have no errors and are current, using feedvalidator.py

import os
import subprocess
import sys

def validate_feed(feed_file):
    print("Validating GTFS %s..." % feed_file)
    p = subprocess.Popen(['feedvalidator.py', '--output=CONSOLE',
                          '-m', '-n', feed_file], stdout=subprocess.PIPE)
    out = p.communicate()
    res = out[0].split('\n')
    for ln in res:
        print(ln)
    # find output line with count of errors/warnings
    errct = res[-2:-1][0]
    if errct.find('error') > -1:
        print("Feed validator found errors in " + feed_file + ":  " + errct + ".")
        sys.exit(1)
    elif out[0].find('this feed is in the future,') > -1:
        print("Feed validator found GTFS not in service until future.")
        sys.exit(2)
    elif out[0].find('feed expired on') > -1:
        print("Feed validator found GTFS has expired.")
        sys.exit(3)
    else:
        if errct.find('successfully') > -1:
            print("Feed looks great:  " + errct + ".")
        else:
            # have warnings
            print("Feed " + feed_file + " looks ok:  " + errct[7:] + ".")

# validate all zip files in current directory as GTFS
for p, ds, fs in os.walk('.'):
    for f in fs:
        if f.endswith('.zip'):
            validate_feed(os.path.join(p, f))
