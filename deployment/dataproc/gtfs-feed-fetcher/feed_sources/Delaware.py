"""Fetch Delaware First State feed."""
import logging

from FeedSource import FeedSource

URL = 'https://dartfirststate.com/RiderInfo/Routes/gtfs_data/dartfirststate_de_us.zip'

LOG = logging.getLogger(__name__)


class Delaware(FeedSource):
    """Fetch DART feed."""
    def __init__(self):
        super(Delaware, self).__init__()
        self.urls = {'dart.zip': URL}
