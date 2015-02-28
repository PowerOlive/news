/**
 * ownCloud - News
 *
 * This file is licensed under the Affero General Public License version 3 or
 * later. See the COPYING file.
 *
 * @author Bernhard Posselt <dev@bernhard-posselt.com>
 * @copyright Bernhard Posselt 2014
 */

/**
 * This prefills the add feed section if an external link has ?subsribe_to
 * filled out
 */
(function (window, document, navigator, url, $, undefined) {
    'use strict';

    // register reader as feed reader in firefox
    var location = window.location;
    var storage = window.localStorage;

    // if isContentHandlerRegistered is not implemented (Firefox I'm looking
    // at you) we use localstorage to prevent registering the feed reader twice
    var isRegistered = function (mime, url) {
        if (navigator.isContentHandlerRegistered) {
            return navigator.isContentHandlerRegistered(mime, url) === 'new';
        } else {
            return storage.getItem('registeredHandler') !== url;
        }
    };

    var registerHandler = function (mime, url, title) {
        if (navigator.registerContentHandler && !isRegistered(mime, url)) {
            navigator.registerContentHandler(mimeType, subscribeUrl, title);
            if (!navigator.isContentHandlerRegistered) {
                storage.setItem('registeredHandler', url);
            }
        }
    };

    var cleanUrl = location.protocol + '//' + location.host + location.pathname;

    var subscribeUrl = cleanUrl + '?subscribe_to=%s';
    var mimeType = 'application/vnd.mozilla.maybe.feed';
    var title = 'ownCloud News @ ' + cleanUrl;

    registerHandler(mimeType, subscribeUrl, title);


    $(document).ready(function () {
        var subscription = window.decodeURIComponent(url('?subscribe_to'));

        console.log(subscription);

        if (subscription && subscription !== 'null') {
            $('#new-feed').show();

            var input = $('input[ng-model="Navigation.feed.url"]');
            input.val(subscription);

            // hacky way to focus because initial loading of a feed
            // steals the focus
            setTimeout(function() {
                input.focus();
            }, 1000);
        }
    });

})(window, document, navigator, url, $);
