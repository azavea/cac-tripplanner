from base58 import b58encode
import uuid


class LinkShortener(object):
    """Shorten links"""
    # If the logic of this function is changed, you will also likely need to
    # change urls.py and the ShortenedLink.key field.
    def generate_key(self, link_text):
        return b58encode(uuid.uuid4().bytes)
