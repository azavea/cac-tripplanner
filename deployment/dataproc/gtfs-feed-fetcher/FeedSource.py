"""Defines base class for feed(s) from an agency.

To add a new feed, add a subclass of this to the `feed_sources` directory.
"""
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
import logging
import os
import pickle
import subprocess
import zipfile

import requests

LOG = logging.getLogger(__name__)

# format time checks like last-modified header
TIMECHECK_FMT = '%a, %d %b %Y %H:%M:%S GMT'
# valid date range format used in feedvalidator output
EFFECTIVE_DATE_FMT = '%B %d, %Y'


class FeedSource(object):
    """Base class for a GTFS source. Class and module names are expected to match.

    Subclass this class and:
        - set class :urls: to a dictionary of { filename: url }:
            :filename: is the what the feed will be saved as (should end in .zip)
            :url: is the URL where the feed will be downloaded from
        - override :fetch: method as necessary to fetch feeds for the agency.
    """
    def __init__(self, ddir=os.path.join(os.getcwd(), 'gtfs')):
        # set properties
        self._ddir = ddir
        self._urls = None
        self._status = {}
        self._status_file = os.path.join(self.ddir, self.__class__.__name__ + '.p')
        # load file of feed statuses
        self.load_status()

    @property
    def ddir(self):
        """Directory to download feeds into."""
        return self._ddir
    @ddir.setter
    def ddir(self, value):
        self._ddir = value

    @property
    def urls(self):
        """Set to a dictionary of { filename: url } for agency"""
        return self._urls
    @urls.setter
    def urls(self, value):
        self._urls = value

    @property
    def status(self):
        """Attributes for each feed:
            - is_new (this run)
            - is_valid (has no errors; ignoring effective date range)
            - is_current (false if service not currently effective)
            - effective_from
            - effective_to
            - posted_date (When feed was posted, or when retrieved, if post date unknown)
            - newly_effective - set if feed was not effective when retrieved, but is now
            - error - message if error encountered in processing; other fields will be unset
        """
        return self._status
    @status.setter
    def status(self, value):
        self._status = value

    @property
    def status_file(self):
        """Pickle file where feed statuses and their time checks are stored.

        Defaults to name file after class, and store it in :ddir:."""
        return self._status_file
    @status_file.setter
    def status_file(self, value):
        self._status_file = value


    def fetch(self):
        """Modify this method in sub-class for importing feed(s) from agency.

        By default, loops over given URLs, checks the last-modified header to see if a new
        download is available, streams the download if so, and verifies the new GTFS.
        """
        if self.urls:
            for filename in self.urls:
                self.fetchone(filename, self.urls.get(filename))
                self.write_status()
        else:
            LOG.warn('No URLs to download for %s.', self.__class__.__name__)

    def load_status(self):
        """Read in pickled log of last times files were downloaded."""
        if os.path.isfile(self.status_file):
            with open(self.status_file, 'rb') as tcf:
                self.status = pickle.load(tcf)
                LOG.debug('Loaded status file.')
            if self.status.has_key('last_check'):
                last_fetch = self.status.get('last_check')
                LOG.info('Last fetch at: %s', last_fetch)
                elapsed = datetime.now() - last_fetch
                LOG.info('Time since last fetch: %s', elapsed)
        else:
            LOG.debug('Will create new feed status file.')

        self.status['last_check'] = datetime.now()

    def write_status(self):
        """Write pickled log of feed statuses and last times files were downloaded."""
        LOG.debug('Downloading finished.  Writing status file %s...', self.status_file)
        with open(self.status_file, 'wb') as tcf:
            pickle.dump(self.status, tcf)
            LOG.debug('Statuses written to %s.', self.status_file)

    def fetchone(self, file_name, url, **stream):
        """Download and validate a single feed.

        :param file_name: Name to which downloaded file should be saved in :ddir: (relative)
        :param url: Location where GTFS will be downloaded from
        :param **stream: Additional arguments to pass to :download:
        :returns: True if file was downloaded successfully and passed verification
        """
        if self.download(file_name, url, **stream):
            if self.verify(file_name):
                LOG.info('GTFS verification succeeded.')
                return True
            else:
                LOG.error('GTFS verification failed.')
                return False
        else:
            return False

    def verify(self, file_name):
        """Verify downloaded file looks like a good GTFS, using Google's feedvalidator.py.

        :param file_name: Name of GTFS to verify in :ddir: (relative)
        :returns: True if GTFS passed validation (excluding future effective date rule)
        """
        is_valid = False
        # file_name is local to download directory
        downloaded_file = os.path.join(self.ddir, file_name)
        if not os.path.isfile(downloaded_file):
            self.set_error(file_name, 'File not found for validation')
            return False

        # validation output for foo.zip will be saved as foo.html
        validation_output_file = os.path.join(self.ddir, file_name[:-4] + '.html')
        LOG.info('Validating feed in %s...', file_name)

        process_cmd = ['feedvalidator.py',
                       '--output=' + validation_output_file,
                       '--memory_db',
                       '--noprompt',
                       downloaded_file]

        # Process returns failure on warnings, which most feeds have;
        # we will return success here if there are only warnings and no errors.
        try:
            out = subprocess.Popen(process_cmd, stdout=subprocess.PIPE).communicate()
        except Exception as ex:
            LOG.error('feedvalidator.py errorred processing %s.', file_name)
            raise ValueError('Error validating %s: %s', file_name, ex)

        errct = out[0].split('\n')[-2:-1][0]
        if errct.find('error') > -1:
             # output line with count of errors/warnings
            LOG.error('Feed validator found errors in %s: %s. ' +
                      'Check transitfeedcrash.txt for details.', file_name, errct)
            # grab error messages to display
            errors = []
            with open(validation_output_file, 'rb') as output:
                soup = BeautifulSoup(output, 'html.parser')
                error_section = soup.find('h3', class_='issueHeader', string='Errors:')
                if error_section:
                    error_list = error_section.find_next('ul')
                    error_divs = error_list.find_all('div', class_='problem')
                    for error in error_divs:
                        error_message = error.get_text(strip=True)
                        errors.append(error_message)
            error_messages = ';'.join(errors)
            raise ValueError('Error validating %s: %s' % (file_name, error_messages))

        elif out[0].find('this feed is in the future,') > -1:
            # will check for this again when we get the effective dates from the HTML output
            LOG.warn('Feed validator found GTFS not in service until future for %s.', file_name)
        else:
            is_valid = True
            if errct.find('successfully') > -1:
                LOG.info('Feed %s looks great:  %s.', file_name, errct)
            else:
                # have warnings
                LOG.info('Feed %s looks ok:  %s.', file_name, errct[7:])


        # look at HTML validation output to find effective date range
        with open(validation_output_file, 'rb') as output:
            soup = BeautifulSoup(output, 'html.parser')
            effective_dates = soup.find(text='Effective:').findParent().findNextSibling().text
            LOG.debug('Feed effective %s.', effective_dates)
            if effective_dates and effective_dates.find(' to ') > -1:
                from_date_str, to_date_str = effective_dates.split(' to ')
                from_date = datetime.strptime(from_date_str, EFFECTIVE_DATE_FMT)
                to_date = datetime.strptime(to_date_str, EFFECTIVE_DATE_FMT)
            else:
                LOG.debug('No effective dates found for feed %s.', file_name)
                from_date = 'UNKNOWN'
                to_date = 'UNKNOWN'

        # should have status with at least posted_date set at this point
        self.status[file_name]['is_new'] = True
        self.status[file_name]['is_valid'] = is_valid
        self.status[file_name]['effective_from'] = from_date
        self.status[file_name]['effective_to'] = to_date
        # check if current once effective dates have been set
        self.status[file_name]['is_current'] = self.is_current(file_name)

        return is_valid

    def is_current(self, file_name):
        """Check if feed is currently effective.

        .. note::
           Expects effective_from and effective_to to be set on :status: for file.

        :param file_name: Name of GTFS file downloaded (relative to :ddir:)
        :returns: True if feed is currently effective.
        """
        stat = self.status.get(file_name)
        if not stat or stat.has_key('error') or not stat.has_key('effective_from'):
            LOG.error('No status effective dates found for %s.', file_name)
            return False
        if not isinstance(stat['effective_from'], datetime):
            LOG.warn('Feed %s has no effective dates in calendar.txt.', file_name)
            return True
        today = datetime.today()
        warn_days = 30  # warn if feed is within this many days of expiring
        if stat['effective_from'] > today:
            LOG.warn('Feed %s not effective until %s.', file_name, stat['effective_from'])
            return False
        if stat['effective_to'] < today:
            LOG.warn('Feed %s expired %s.', file_name, stat['effective_to'])
            return False
        elif stat['effective_to'] <= (today + timedelta(days=warn_days)):
            LOG.warn('Feed %s will expire %s.', file_name, stat['effective_to'])
        LOG.debug('Feed %s is currently effective.', file_name)
        return True

    def update_existing_status(self, file_name):
        """Update the status entry for a file when no new download is available."""
        stat = self.status.get(file_name)
        if not stat:
            LOG.error('No status entry found for %s; not setting effective status.', file_name)
            return
        self.status[file_name]['is_new'] = False
        was_current = self.status[file_name].get('is_current')
        now_current = self.is_current(file_name)
        self.status[file_name]['is_current'] = now_current
        if not was_current and now_current:
            self.status[file_name]['newly_effective'] = True
            LOG.info('Previously downloaded feed %s has now become effective.')
        elif self.status[file_name].get('newly_effective'):
            del self.status[file_name]['newly_effective']

    def check_header_newer(self, url, file_name):
        """Check if last-modified header indicates a new download is available.

        :param url: Where GTFS is downloaded from
        :param file_name: Name of downloaded file (relative to :ddir:)
        :returns: 1 if newer GTFS available; 0 if info missing; -1 if already have most recent
        """
        if self.status.has_key(file_name) and self.status[file_name].has_key('posted_date'):
            last_fetch = self.status[file_name]['posted_date']
            hdr = requests.head(url)
            hdr = hdr.headers
            if hdr.get('last-modified'):
                last_mod = hdr.get('last-modified')
                if last_fetch >= last_mod:
                    LOG.info('No new download available for %s.', file_name)
                    self.update_existing_status(file_name)
                    return -1
                else:
                    LOG.info('New download available for %s.', file_name)
                    LOG.info('Last download from: %s.', last_fetch)
                    LOG.info('New download posted: %s', last_mod)
                    return 1
            else:
                # should try to find another way to check for new feeds if header not set
                LOG.debug('No last-modified header set for %s download link.', file_name)
                return 0
        else:
            LOG.debug('Time check entry for %s not found.', file_name)
            return 0

    def download(self, file_name, url, do_stream=True):
        """Download feed.

        :param file_name: File name to save download as, relative to :ddir:
        :param url: Where to download the GTFS from
        :param do_stream: If True, stream the download
                :returns: True if download was successful
        """
        LOG.debug('In get_stream to get file %s from URL %s.', file_name, url)
        if self.check_header_newer(url, file_name) == -1:
            # Nothing new to fetch; done here
            return False
        # file_name is local to download directory
        file_path = os.path.join(self.ddir, file_name)
        LOG.info('Getting file %s...from...%s', file_path, url)
        request = requests.get(url, stream=do_stream)

        if request.ok:
            with open(file_path, 'wb') as download_file:
                if do_stream:
                    for chunk in request.iter_content(chunk_size=1024):
                        download_file.write(chunk)
                else:
                    download_file.write(request.content)

            info = os.stat(file_path)
            if info.st_size < 10000:
                # file smaller than 10K; may not be a GTFS
                LOG.warn('Download for %s is only %s bytes.', file_path, str(info.st_size))
            if not zipfile.is_zipfile(file_path):
                self.set_error(file_name, 'Download is not a zip file')
                return False
            posted_date = request.headers.get('last-modified')
            if not posted_date:
                LOG.debug('No last-modified header set')
                posted_date = datetime.utcnow().strftime(TIMECHECK_FMT)
            self.set_posted_date(file_name, posted_date)
            LOG.info('Download completed successfully.')
            return True
        else:
            self.set_error(file_name, 'Download failed')
        return False

    def set_posted_date(self, file_name, posted_date):
        """Update feed status posted date. Creates new feed status if none found.

        :param file_name: Name of feed file, relative to :ddir:
        :param posted_date: Date string formatted to :TIMECHECK_FMT: when feed was posted
        """
        stat = self.status.get(file_name, {})
        stat['posted_date'] = posted_date
        self.status[file_name] = stat

    def set_error(self, file_name, msg):
        """If error encountered in processing, set status error message, and unset other fields.

        :param file_name: Name of feed file, relative to :ddir:
        :param msg: Error message to save with status
        """
        LOG.error('Error processing %s: %s', file_name, msg)
        self.status[file_name] = {'error': msg}
        # write out status file immediately
        self.write_status()
