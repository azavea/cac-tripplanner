import base64
import uuid


# TODO: Switch this to use a shorter scheme, e.g. base58 a la Flickr, or
# some sort of hashing if we want to ensure that identical routes receive the
# same shortened link.
class LinkShortener(object):
    """Shorten links"""
    # If the logic of this function is changed, you will also likely need to
    # change urls.py and the ShortenedLink.key field.
    def generate_key(self, link_text):
        return base64.urlsafe_b64encode(uuid.uuid4().bytes)
