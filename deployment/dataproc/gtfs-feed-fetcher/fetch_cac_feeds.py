#!/usr/bin/env python
"""Command line interface for fetching GTFS."""
import argparse
import logging

from prettytable import PrettyTable

from FeedSource import FeedSource
import feed_sources
# import all the available feed sources
# pylint: disable=I0011,wildcard-import
from feed_sources import *

logging.basicConfig()
LOG = logging.getLogger()
LOG.setLevel(logging.INFO)

def fetch_all(sources=None):
    """Fetch from all FeedSources in the feed_sources directory.

    :param sources: List of :FeedSource: modules to fetch; if not set, will fetch all available.
    """
    statuses = {}  # collect the statuses for all the files

    # make a copy of the list of all modules in feed_sources;
    # default to use all of them
    sources = list(feed_sources.__all__)

    LOG.info('Going to fetch feeds from sources: %s', sources)

    for src in sources:
        LOG.debug('Going to start fetch for %s...', src)
        try:
            mod = getattr(feed_sources, src)
            # expect a class with the same name as the module; instantiate and fetch its feeds
            klass = getattr(mod, src)
            if issubclass(klass, FeedSource):
                inst = klass()
                inst.fetch()
                statuses.update(inst.status)
            else:
                LOG.warn('Skipping class %s, which does not subclass FeedSource.', klass.__name__)
        except AttributeError:
            LOG.error('Skipping feed %s, which could not be found.', src)

    # remove last check key set at top level of each status dictionary
    if statuses.has_key('last_check'):
        del statuses['last_check']

    # display results
    ptable = PrettyTable()

    for file_name in statuses:
        stat = statuses[file_name]
        msg = []
        msg.append(file_name)
        msg.append('x' if stat.has_key('is_new') and stat['is_new'] else '')
        msg.append('x' if stat.has_key('is_valid') and stat['is_valid'] else '')
        msg.append('x' if stat.has_key('is_current') and stat['is_current'] else '')
        msg.append('x' if stat.has_key('newly_effective') and stat.get('newly_effective') else '')
        if stat.has_key('error'):
             msg.append(stat['error'])
        else:
             msg.append('')
        ptable.add_row(msg)

    ptable.field_names = ['file', 'new?', 'valid?', 'current?', 'newly effective?', 'error']
    LOG.info('Results:\n%s', ptable.get_string())
    LOG.info('All done!')

def main():
    """Main entry point for command line interface."""
    parser = argparse.ArgumentParser(description='Fetch GTFS feeds and validate them.')
    parser.add_argument('--verbose', '-v', action='count',
                        help='Set output log level to debug (default log level: info)')

    args = parser.parse_args()
    if args.verbose:
        LOG.setLevel(logging.DEBUG)

    # By default will fetch 'Septa','Patco','Delaware','NJTransit'
    fetch_all()

if __name__ == '__main__':
    main()
