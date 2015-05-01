/**
 *  Share links on social media.
 *
 */
CAC.Share.Social = (function ($, Settings) {
    'use strict';

    var defaults = {
        useHost: window.location.protocol + '//' + window.location.host
    };
    var options = {};

    function Social(params) {
        // recursively extend objects, so those not overridden will still exist
        options = $.extend(true, {}, defaults, params);
    }

    Social.prototype = {
        shareOnFacebook: shareOnFacebook,
        shareOnGooglePlus: shareOnGooglePlus,
        shareOnTwitter: shareOnTwitter
    };

    return Social;

    function shareOnFacebook(event) {
        var caption = 'Trip Plan on GoPhillyGo';

        // TODO: get a screenshot of the map page to post?
        var pictureUrl = [options.useHost,
                          '/static/images/logo_color.svg'
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
            event.returnValue = false;
            event.preventDefault();
        }

        event.returnValue = false;
        event.preventDefault();
    }

    function shareOnGooglePlus(event) {
        // TODO: make interactive post instead?
        // https://developers.google.com/+/web/share/interactive

        // use the share endpoint directly
        // https://developers.google.com/+/web/share/#sharelink-endpoint
        var shareUrl = 'https://plus.google.com/share';
        var params = {
            url: event.data.url
        };
        var url = shareUrl + '?' + $.param(params);
        var windowOptions = 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=600,width=600';
        window.open(url, '', windowOptions);
        event.returnValue = false;
        event.preventDefault();
    }

    function shareOnTwitter(event) {
        var intentUrl = 'https://twitter.com/intent/tweet';
        // TODO: get tweet wording
        var tweet = 'Check out my trip on GoPhillyGo!';
        // @go_philly_go twitter account is "related" to tweet (might suggest to follow)
        var related ='go_philly_go:GoPhillyGo on Twitter';
        // TODO: use via?

        var tweetParams = {
            url: event.data.url,
            text: tweet,
            related: related
        };

        var url = intentUrl + '?' + $.param(tweetParams);

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

        window.open(url, 'intent', windowOptions);
        event.returnValue = false;
        event.preventDefault();
    }

})(jQuery, CAC.Settings);
