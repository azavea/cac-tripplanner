"""Fetch official PATCO feed."""

import logging
import requests
from bs4 import BeautifulSoup

from FeedSource import FeedSource

DEVPAGE_URL = 'http://www.ridepatco.org/developers/'
FILE_NAME = 'PortAuthorityTransitCorporation.zip'

LOG = logging.getLogger(__name__)


class Patco(FeedSource):
    """Fetch official PATCO feed."""
    def __init__(self):
        super(Patco, self).__init__()
        url = self.find_download_url()
        if url:
            self.urls = {'patco.zip': url}
        else:
            LOG.error('Could not scrape PATCO GTFS download URL from developer page')
            self.urls = {}

    def find_download_url(self):
        """Helper to scrape developer's page for the download URL, which changes"""
        devpage = requests.get(DEVPAGE_URL)
        soup = BeautifulSoup(devpage.text, 'html.parser')
        rt = soup.find(id='rightcolumn')
        anchors = rt.findAll('a')
        for anchor in anchors:
            href = anchor.attrs['href']
            if href.endswith('.zip'):
                return href

        # if got this far, no GTFS download link found
        return None
