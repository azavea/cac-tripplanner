/**
 *  Share links on social media.
 *
 */
CAC.Share.Social = (function ($, Settings) {
    'use strict';

    var defaults = {
        useHost: window.location.protocol + '//' + window.location.host,
        selectors: {
            modal: '#linkModal',
            modalLink: '#modalDirectionsLink'
        }
    };
    var options = {};

    function Social(params) {
        // recursively extend objects, so those not overridden will still exist
        options = $.extend(true, {}, defaults, params);
    }

    Social.prototype = {
        shareDirectLink: shareDirectLink,
        shareOnFacebook: shareOnFacebook,
        shareOnGooglePlus: shareOnGooglePlus,
        shareOnTwitter: shareOnTwitter,
        shareViaEmail: shareViaEmail,
        shortenLink: shortenLink
    };

    return Social;

    /**
     * Open popup for user to post directions link to their timeline.
     *
     * @param {object} event Triggering click event; expected to have data.url set to link to share
    */
    function shareOnFacebook(event) {
        var caption = 'Trip Plan on GoPhillyGo';

        // TODO: get a screenshot of the map page to post? Shouldn't be using logo.
        var pictureUrl = [options.useHost,
                          '/static/images/logo_color.png'
                         ].join('');

        if (typeof FB !== 'undefined') {
            // prompt user to log in, if they aren't already
            FB.getLoginStatus(function(response) {
                if (response.status !== 'connected') {
                    FB.login();
                }
            });

            FB.ui({
                method: 'feed',
                link: event.data.url,
                caption: caption,
                picture: pictureUrl,
            }, function(response){
                if (!response || _.has(response, 'error_code')) {
                    console.warn(response);
                    console.warn('did not post to facebook');
                }
            });
        } else {
            console.warn('FB unavailable. Is script loaded?');
            // redirect to URL if API unavailable

            var feedUrl = 'https://www.facebook.com/dialog/feed?';

            /* jshint camelcase:false */
            var params = {
                app_id: Settings.fbAppId,
                display: 'popup',
                caption: caption,
                picture: pictureUrl,
                link: event.data.url,
                redirect_uri: options.useHost + '/map'
            };
            /* jshint camelcase:true */

            var url = feedUrl + $.param(params);
            window.open(url, '_blank');
        }
    }

    /**
     * Open popup for user to post directions link to Google+.
     *
     * @param {object} event Triggering click event; expected to have data.url set to link to share
    */
    function shareOnGooglePlus(event) {
        // TODO: make interactive post instead?
        // https://developers.google.com/+/web/share/interactive

        // use the share endpoint directly
        // https://developers.google.com/+/web/share/#sharelink-endpoint
        var shareUrl = 'https://plus.google.com/share';
        var windowOpts = 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=600,width=600';

        var params = {
            url: event.data.url
        };
        var url = shareUrl + '?' + $.param(params);
        window.open(url, '', windowOpts);
    }

    /**
     * Open popup for user to tweet directions link.
     *
     * @param {object} event Triggering click event; expected to have data.url set to link to share
    */
    function shareOnTwitter(event) {
        var intentUrl = 'https://twitter.com/intent/tweet';
        // TODO: change tweet wording?
        var tweet = 'Check out my trip on GoPhillyGo!';
        // @go_philly_go twitter account is "related" to tweet (might suggest to follow)
        var related ='go_philly_go:GoPhillyGo on Twitter';
        // TODO: use via?

        // open in a popup like standard Twitter button; see 'Limited Dependencies' section here:
        // https://dev.twitter.com/web/intents
        var winWidth = screen.width;
        var winHeight = screen.height;
        var width = 550;
        var height = 420;
        var left = Math.round((winWidth / 2) - (width / 2));
        var top = 0;
        if (winHeight > height) {
            top = Math.round((winHeight / 2) - (height / 2));
        }

        var windowOptions = ['scrollbars=yes,resizable=yes,toolbar=no,location=yes',
                             ',width=', + width,
                             ',height=' + height,
                             ',left=' + left,
                             ',top=' + top
                            ].join('');

        var tweetParams = {
                url: event.data.url,
                text: tweet,
                related: related
            };
            var url = intentUrl + '?' + $.param(tweetParams);
            window.open(url, 'intent', windowOptions);
            event.returnValue = false;
            event.preventDefault();
    }

    /**
     * Open email client with message pre-populated with directions link.
     *
     * @param {object} event Triggering click event; expected to have data.url set to link to share
     */
    function shareViaEmail(event) {
        var mailToLink = ['mailto:?subject=My Trip on GoPhillyGo',
                          '&body=Check out my trip on GoPhillyGo: ',
                          event.data.url
                         ].join('');
        mailToLink = encodeURI(mailToLink);
        window.location.href = mailToLink;
    }

     /**
     * Open modal to display directions link.
     *
     * @param {object} event Triggering click event; expected to have data.url set to link to share
     */
    function shareDirectLink(event) {
        $(options.selectors.modalLink).text(event.data.url);
        $(options.selectors.modalLink).attr('href', event.data.url);
        $(options.selectors.modal).modal();
    }

    /**
     * Pass URL through link shortener.
     *
     * @param {string} url Link to shorten; must be from this domain
     * @returns {Object} Promsie resolving to shortened URL (or unshortened URL on failure)
     */
    function shortenLink(url) {
        var dfd = $.Deferred();
        var shortenerUrl = '/link/shorten/';
        $.ajax({
            url: shortenerUrl,
            data: JSON.stringify({destination: url}),
            contentType: 'application/json',
            dataType: 'json',
            type: 'POST'
        }).done(function(data) {
            if (data && data.shortenedUrl) {
                dfd.resolve(data.shortenedUrl);
            } else {
                console.error('Unexpected response shortening URL ' + url);
                console.error(data);
                dfd.resolve(url);
            }
        }).fail(function(error) {
            console.error('Failed to shorten URL ' + url);
            console.error(error);
            dfd.resolve(url);
        });
        return dfd.promise();
    }

})(jQuery, CAC.Settings);
