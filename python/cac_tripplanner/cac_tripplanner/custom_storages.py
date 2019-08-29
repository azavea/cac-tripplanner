import urllib.request
import urllib.parse
import urllib.error

from storages.backends.s3boto import S3BotoStorage


class PublicS3BotoStorage(S3BotoStorage):
    """
    Override of S3BotoStorage that strips authentication parameters for use with public buckets

    This is needed because of a boto issue: https://github.com/boto/boto/issues/1477
    When the issue is fixed, set the AWS_QUERYSTRING_AUTH setting to false and
    remove this workaround.

    This class was borrowed from: https://github.com/boto/boto/issues/1477#issuecomment-38759048
    """
    def __init__(self, *a, **k):
        kwargs = dict(querystring_auth=False)
        # merge in any arguments that were passed
        kwargs.update(k)
        super(PublicS3BotoStorage, self).__init__(*a, **kwargs)

    def url(self, name):
        orig = super(PublicS3BotoStorage, self).url(name)
        scheme, netloc, path, params, query, fragment = urllib.parse.urlparse(orig)
        params = urllib.parse.parse_qs(query)
        if 'x-amz-security-token' in params:
            del params['x-amz-security-token']
        query = urllib.parse.urlencode(params)
        return urllib.parse.urlunparse((scheme, netloc, path, params, query, fragment))
