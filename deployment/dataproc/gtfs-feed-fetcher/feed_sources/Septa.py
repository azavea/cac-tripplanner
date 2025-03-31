"""Fetch SEPTA (Philadelphia) bus and rail feeds."""

from datetime import datetime
import logging
import os
import zipfile

import requests

from FeedSource import FeedSource, TIMECHECK_FMT

URL = 'https://api.github.com/repos/septadev/GTFS/releases/latest'
LAST_UPDATED_FMT = '%Y-%m-%dT%H:%M:%SZ'

# SEPTA provides two GTFS .zip files themselves zipped together
DOWNLOAD_FILE_NAME = 'septa.zip'
# names of the two files in the downloaded .zip
BUS_EXTRACT_FILE = 'google_bus.zip'
RAIL_EXTRACT_FILE = 'google_rail.zip'
# rename the extrated GTFS to this
BUS_FILE = 'septa_bus.zip'
RAIL_FILE = 'septa_rail.zip'

LOG = logging.getLogger(__name__)


class Septa(FeedSource):
    """Fetch SEPTA feeds."""
    def __init__(self):
        super(Septa, self).__init__()
        self.urls = {DOWNLOAD_FILE_NAME: URL}

    def fetch(self):
        """Fetch SEPTA bus and rail feeds.
        """
        # Check GitHub latest release page to see if there is a newer download available.
        request = requests.get(URL)
        if request.ok:
            response = request.json()
            download_url = response['assets'][0]['browser_download_url']
            last_updated_str = response['assets'][0]['updated_at']
            last_updated = datetime.strptime(last_updated_str, LAST_UPDATED_FMT)
            stat = self.status.get(BUS_FILE)
            if stat:
                got_last = datetime.strptime(stat['posted_date'], TIMECHECK_FMT)
                LOG.debug('SEPTA GTFS last fetched: %s, last updated: %s', got_last, last_updated)
                if got_last >= last_updated:
                    LOG.info('No new download available for SEPTA.')
                    self.update_existing_status(BUS_FILE)
                    self.update_existing_status(RAIL_FILE)
                    return
            else:
                LOG.info('No previous SEPTA download found. Last update posted: %s', last_updated)

            posted_date = last_updated.strftime(TIMECHECK_FMT)
            self.set_posted_date(BUS_FILE, posted_date)
            self.set_posted_date(RAIL_FILE, posted_date)


            if self.download(DOWNLOAD_FILE_NAME, download_url, do_stream=False):
                # remove posted date status for parent zip
                del self.status[DOWNLOAD_FILE_NAME]
                septa_file = os.path.join(self.ddir, DOWNLOAD_FILE_NAME)
                if self.extract(septa_file):
                    self.write_status()
                # delete download file once the two GTFS zips in it are extracted
                os.remove(septa_file)
            else:
                # clear error for parent septa.zip download, and set statuses for bus and rail feeds
                err = self.status.get(DOWNLOAD_FILE_NAME, 'Could not download file')
                self.status = {}
                self.set_error(BUS_FILE, err)
                self.set_error(RAIL_FILE, err)
                self.write_status()
        else:
            LOG.error('Could not check GitHub relases page for SEPTA.')

    def extract(self, file_name):
        """Extract bus and rail GTFS files from downloaded zip, then validate each."""
        with zipfile.ZipFile(file_name) as zipped_septa:
            if len(zipped_septa.namelist()) == 2:
                zipped_septa.extractall(path=self.ddir)
                bus_path = os.path.join(self.ddir, BUS_EXTRACT_FILE)
                rail_path = os.path.join(self.ddir, RAIL_EXTRACT_FILE)
                if os.path.isfile(bus_path) and os.path.isfile(rail_path):
                    # rename the extracted files
                    os.rename(rail_path, os.path.join(self.ddir, RAIL_FILE))
                    os.rename(bus_path, os.path.join(self.ddir, BUS_FILE))

                    rail_good = bus_good = False
                    if self.verify(BUS_FILE):
                        bus_good = True
                    else:
                        LOG.warn('SEPTA bus GTFS verification failed.')
                    if self.verify(RAIL_FILE):
                        rail_good = True
                    else:
                        LOG.warn('SEPTA rail GTFS verification failed.')
                    if rail_good and bus_good:
                        LOG.info('SEPTA bus and rail verification succeeded.')
                        return True
                    return False
                else:
                    LOG.error('Could not find SEPTA GTFS files with expected names.')
                    return False
            else:
                LOG.error('Unexpected contents in SEPTA zip file download: %s',
                          zipped_septa.namelist())
                LOG.error('Expected two files, but got %s.',
                          len(zipped_septa.namelist()))
                LOG.error('Not extracting SEPTA zip.')
                return False

        LOG.error('How did we get here? In SEPTA extract.')
        return False # should be unreachable
