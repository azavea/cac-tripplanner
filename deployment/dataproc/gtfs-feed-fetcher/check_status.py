#!/usr/bin/env python
"""Command line interface for reporting on downloaded feed statuses."""
import argparse
from datetime import datetime, timedelta
import logging
import os
import pickle
import sys

DOWNLOAD_DIRECTORY = 'gtfs'
# warn if feed is within this many days of expiring
WARN_DAYS = 30

logging.basicConfig()
LOG = logging.getLogger()
LOG.setLevel(logging.WARN)


def check_current(file_name, stat, warn_days):
    """Check effective date range on feed."""
    today = datetime.today()
    try:
        if not stat.get('effective_from') or not stat.get('effective_to'):
            LOG.warn('No effective date range for %s.', file_name)
        elif stat['effective_from'] > today:
            LOG.warn('Feed %s not effective until %s.', file_name, stat['effective_from'])
            return False
        elif stat['effective_to'] < today:
            LOG.warn('Feed %s expired %s.', file_name, stat['efective_to'])
            return False
        elif stat['effective_to'] <= (today + timedelta(days=warn_days)):
            LOG.warn('Feed %s will expire %s.', file_name, stat['effective_to'])
        LOG.info('Feed %s is currently effective.', file_name)
    except TypeError:
        LOG.warn('No effective date range for %s.', file_name)

def read_status(file_name, statuses, warn_days):
    """Read and log messages about passed status dictionary."""
    if not isinstance(statuses, dict):
        LOG.error('Status is not in dictionary format.')
        return

    try:
        last = statuses.pop('last_check')
        LOG.info('%s last checked %s.', file_name, last)
        for feed in statuses:
            LOG.debug('Checking status for feed %s...', feed)
            stat = statuses[feed]
            if stat.has_key('error'):
                LOG.error('Error processing %s: %s', feed, stat['error'])
                return
            if stat['is_new']:
                LOG.info('Feed %s is new.', feed)
            else:
                LOG.debug('Feed %s is not new.', feed)
            if stat['is_valid']:
                LOG.debug('Feed %s is valid.', feed)
            else:
                LOG.warn('Feed %s is not valid.', feed)
            check_current(feed, stat, warn_days)
            if stat.get('newly_effective'):
                LOG.warn('Feed %s has become effective since the preceeding check.', feed)

    except KeyError as ex:
        LOG.error('Status for %s not in expected format.  Missing key: %s', file_name, ex.message)

def check_status(status_directory, warn_days):
    """Report on the status of the downloaded feeds, according to their status files in the
    download directory."""
    status_files = []
    for pdir, dirs, feed_files in os.walk(status_directory):
        if dirs:
            LOG.warn('Download directory should be flat, but contains directories: %s.', dirs)
        for feed_file in feed_files:
            if feed_file.endswith('.p'):
                status_files.append(os.path.join(pdir, feed_file))

    LOG.debug(status_files)

    for status_path in status_files:
        with open(status_path, 'rb') as statfile:
            LOG.debug('Reading status file %s...', status_path)
            status = pickle.load(statfile)
            read_status(os.path.basename(status_path), status, warn_days)

    LOG.info('All done!')

def main():
    """Main entry point for command line interface."""
    parser = argparse.ArgumentParser(description='Report on status for downloaded GTFS.')
    parser.add_argument('--download-directory', '-d',
                        default=os.path.join(os.getcwd(), DOWNLOAD_DIRECTORY),
                        help='Full path to status files directory (default: ./%s/)' %
                        DOWNLOAD_DIRECTORY)
    parser.add_argument('--warn-expiry-days', '-w', type=int,
                        default=WARN_DAYS,
                        help='Warn if feed will expire within this many days (default: %s)' %
                        WARN_DAYS)
    parser.add_argument('--verbose', '-v',
                        action='count',
                        help='Increase log level verbosity (default log level: warn)')

    args = parser.parse_args()
    if args.verbose:
        if args.verbose > 1:
            LOG.setLevel(logging.DEBUG)
        else:
            LOG.setLevel(logging.INFO)

    if not os.path.isdir(args.download_directory):
        LOG.error('Directory %s not found.  Exiting.', args.download_directory)
        sys.exit(1)
    else:
        LOG.debug('Checking statuses in %s...', args.download_directory)
        check_status(args.download_directory, args.warn_expiry_days)

if __name__ == '__main__':
    main()
