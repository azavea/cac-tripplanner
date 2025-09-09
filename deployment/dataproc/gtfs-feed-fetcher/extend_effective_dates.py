#!/usr/bin/env python
"""Command line interface for extending feed effective dates."""
import argparse
import csv
from datetime import datetime, timedelta
import logging
import os
import shutil
import sys
import zipfile

DOWNLOAD_DIRECTORY = 'gtfs'
# extend feed effective date range this far into the past and future
EFFECTIVE_DAYS = 365
GTFS_DATE_FMT = '%Y%m%d'

logging.basicConfig()
LOG = logging.getLogger()
LOG.setLevel(logging.INFO)


def extend_feed(feed_path, effective_days):
    """Extend feed effective date range.

    :param feed_path: Full path to the GTFS to extend
    :param effective_days Number of days from today the feed should extend into future and past
    """
    file_name = os.path.basename(feed_path)
    tmpdir = os.path.join(os.path.dirname(feed_path), 'tmp')
    if os.path.isdir(tmpdir):
        shutil.rmtree(tmpdir)
    os.mkdir(tmpdir)
    try:
        with zipfile.ZipFile(feed_path, 'r') as feedzip:
            if 'calendar.txt' not in feedzip.namelist():
                LOG.warn('Feed %s has no calendar.txt; cannot extend effective date range.',
                         file_name)
                return

            LOG.debug('calendar.txt found for %s. Extracting zip.', file_name)
            feedzip.extractall(tmpdir)
    except zipfile.BadZipfile:
        LOG.error('Could not process zip file %s.', file_name)

    with open(os.path.join(tmpdir, 'calendar.txt'), 'rb') as cal_file:
        csvdict = csv.DictReader(cal_file, skipinitialspace=True)
        fldnames = csvdict.fieldnames
        cal = [x for x in csvdict]
    # flag to track whether this feed's effective dates have actually been extended
    cal = extended_calendar(cal, effective_days)
    if cal:
        with open(os.path.join(tmpdir, 'calendar.txt'), 'wb') as cal_file:
            csvdict = csv.DictWriter(cal_file, fieldnames=fldnames)
            csvdict.writeheader()
            csvdict.writerows(cal)
            LOG.info('Done writing new calendar file for %s.', file_name)
        # now re-zip and move the zip back to the download directory
        lastdir = os.getcwd()
        os.chdir(tmpdir)
        with zipfile.ZipFile(os.path.join(os.path.dirname(feed_path),
                                          file_name[:-4] + '_extended.zip'),
                             'w',
                             zipfile.ZIP_DEFLATED) as feedzip:
            for _, dirs, files in os.walk(tmpdir):
                if '__MACOSX' in dirs:
                    dirs.remove('__MACOSX')
                for filename in files:
                    if filename.endswith('.txt'):
                        feedzip.write(filename)
        os.chdir(lastdir)
    else:
        LOG.info('Feed %s does not need extension.', file_name)

    # delete tmp directory when done
    shutil.rmtree(tmpdir)


def extend_feeds(feed_directory, effective_days):
    """Extend effective dates for all fees found in given directory.

    :param feed_directory: Full path to the directory containing the GTFS to extend
    :param effective_days: Number of days from today into future and past to extend the feeds
    """
    LOG.debug('Extending effective dates for feeds in %s...', feed_directory)
    for pdir, _, feed_files in os.walk(feed_directory):
        for feed_file in feed_files:
            if feed_file.endswith('.zip'):
                feed_path = os.path.join(pdir, feed_file)
                if zipfile.is_zipfile(feed_path):
                    extend_feed(feed_path, effective_days)
                else:
                    LOG.warn('File %s does not look like a valid zip file.', feed_file)

    LOG.info('All done!')


def extended_calendar(cal, effective_days):
    """Extends the effective date range for the given calendar.

    :param cal Dictionary of calendar.txt values
    :param effective_days Number of days from today the effective dates should extend
    :returns Extended calendar, or False if calendar does not require extension.
    """
    past_start = datetime.today() - timedelta(days=effective_days)
    future_end = datetime.today() + timedelta(days=effective_days)
    LOG.debug('Extending feed to be effective from %s to %s.', past_start, future_end)
    modified = False
    for entry in cal:
        start_date_str = entry['start_date']
        end_date_str = entry['end_date']
        start_date = datetime.strptime(start_date_str, GTFS_DATE_FMT)
        end_date = datetime.strptime(end_date_str, GTFS_DATE_FMT)
        if start_date <= past_start:
            LOG.debug('Start date %s already includes %s in period.', start_date, past_start)
        else:
            modified = True
            entry['start_date'] = past_start.strftime(GTFS_DATE_FMT)
        if end_date >= future_end:
            LOG.debug('End date %s already includes %s in period.', end_date, future_end)
        else:
            modified = True
            entry['end_date'] = future_end.strftime(GTFS_DATE_FMT)
    return cal if modified else modified


def main():
    """Main entry point for command line interface."""
    parser = argparse.ArgumentParser(description='Extend GTFS effective date range.')
    parser.add_argument('--download-directory', '-d',
                        default=os.path.join(os.getcwd(), DOWNLOAD_DIRECTORY),
                        help='Full path to GTFS directory (default: ./%s/)' %
                        DOWNLOAD_DIRECTORY)
    parser.add_argument('--extend-days', '-e', type=int,
                        default=EFFECTIVE_DAYS,
                        help='Extend GTFS this many days into past and future (default: %s)' %
                        EFFECTIVE_DAYS)
    parser.add_argument('--feeds', '-f',
                        default=None,
                        help='Comma-separated list of feeds to get (optional; default: all)')
    parser.add_argument('--verbose', '-v',
                        action='count',
                        help='Increase log level verbosity (default log level: info)')

    args = parser.parse_args()
    if args.verbose:
        LOG.setLevel(logging.DEBUG)

    if not os.path.isdir(args.download_directory):
        LOG.error('GTFS directory %s not found. Exiting.', args.download_directory)
        sys.exit(1)

    if args.extend_days < 1:
        LOG.error('--extend-days must be a positive integer. Exiting.')
        sys.exit(2)

    if args.feeds:
        feeds = args.feeds.split(',')
        for feed in feeds:
            LOG.debug('Going to extend feed %s...', feed)
            extend_feed(os.path.join(args.download_directory, feed), args.extend_days)
        LOG.info('All done!')
    else:
        extend_feeds(args.download_directory, args.extend_days)

if __name__ == '__main__':
    main()
