/**
* ownCloud - News app
*
* @author Bernhard Posselt
* Copyright (c) 2012 - Bernhard Posselt <nukeawhale@gmail.com>
*
* This file is licensed under the Affero General Public License version 3 or later.
* See the COPYING-README file
*
*/

/**
 * This file includes objects for binding and accessing the feed menu
 */

/**
 * HOWTO
 *

We create a new instance of the menu. Then we need to bind it on an ul which contains
all the items:
    
    var updateIntervalMiliseconds = 2000;
    var menu = new News.Menu(updateIntervalMiliseconds);
    menu.bindOn('#feeds ul');

Updating nodes (you dont have to set all values in data):

    var nodeType = News.MenuNodeType.Feed;
    var nodeId = 2;
    var nodeData = {
        unreadCount: 4,
        title: 'The verge'
    }
    menu.updateNode(nodeType, nodeId, nodeData);


Deleting nodes:

    var id = 2;
    var type = News.MenuNodeType.Feed;
    var removedObject = menu.removeNode(type, id);


Creating nodes:
    
    var parentId = 0;
    var nodeType = News.MenuNodeType.Feed;
    var nodeId = 6;
    var nodeData = {
        title: 'hi',
        icon: 'some/icon.png',
        unreadCount: 3
    };
    menu.addNode(parentId, nodeType, nodeId, nodeData);


If you want to show all feeds, also feeds which contain only read items, use

    menu.setShowAll(true);

If you want to hide feeds and folders with only read items, use

    menu.setShowAll(false);

The default value is false. If you want to toggle this behaviour, theres a shortcut

    menu.toggleShowAll();


To hide all articles with read feeds, the setShowAll has to be set to false. The 
hiding is only triggered after a new feed/folder was being loaded. If you wish to
trigger this manually, use:

    menu.triggerHideRead();

*/

var News = News || {};

(function(){

    /*##########################################################################
     * MenuNodeType
     *#########################################################################/
    /**
     * Enumeration for menu items
     */
    MenuNodeType = {
        'Feed': 0,
        'Folder': 1,
        'Starred': 2,
        'Subscriptions': 3
    };

    // map css classes to MenuNodeTypes
    MenuNodeTypeClass = {};
    MenuNodeTypeClass[MenuNodeType.Feed] = 'feed';
    MenuNodeTypeClass[MenuNodeType.Folder] = 'folder';
    MenuNodeTypeClass[MenuNodeType.Starred] = 'starred';
    MenuNodeTypeClass[MenuNodeType.Subscriptions] = 'subscriptions';

    News.MenuNodeType = MenuNodeType; 


    /*##########################################################################
     * Menu
     *#########################################################################/
    /**
     * This is the basic menu used to construct and maintain the menu
     * @param updateIntervalMiliseconds how often the menu should refresh
     */
    Menu = function(updateIntervalMiliseconds){
        var self = this;

        this._updateInterval = updateIntervalMiliseconds;
        setInterval(function(){
            self._updateUnreadCountAll();
        }, self._updateInterval);

        this._items = new News.Items('#feed_items');
        this._showAll = $('#view').hasClass('show_all');

        this._unreadCount = {
            Feed: {},
            Folder: {},
            Starred: 0,
            Subscriptions: 0
        };
    };

    News.Menu = Menu;

    /**
     * Adds a node to the menu. A node can only be added to a folder or to the root
     * @param parentId the id of the parent folder, 0 for root
     * @param type the type (MenuNodeType)
     * @param id the id
     * @param data a json array with the data for the element:
     *   {title: '', icon: 'img/png.png', 'unreadCount': 3}
     */
    Menu.prototype.addNode = function(parentId, type, id, data){
        var $parentNode;
        if(parseInt(parentId) === 0){
            $parentNode = this._$root;
        } else {
            $parentNode = this._getNodeFromTypeAndId(type, id).children('ul');
            // every folder we add to should be opened again
            $parentNode.parent().addClass('open');
            $parentNode.show();
            $parentNode.siblings('.collapsable_trigger').removeClass('triggered');
        }

        var $html;
        var icon = 'url("' + data.icon + '")';
        switch(type){
            case MenuNodeType.Feed:
                $html = this._$mockFeed.clone();
                break;
            case MenuNodeType.Folder:
                $html = this._$mockFolder.clone();
                break;
            default:
                console.log('Can only create folders or feeds');
                break;
        }   

        $html.children('.title').html(data.title);
        $html.children('.title').css('background-image', icon);
        $html.children('.unread_items_counter').html(data.unreadCount);
        $html.attr('data-id', id);
        $html.children('ul').attr('data-id', id);

        switch(type){
            case MenuNodeType.Feed:
                this._bindFeed($html);
                break;
            case MenuNodeType.Folder:
                this._bindFolder($html);
                break;
        }

        $parentNode.append($html);
        this._resetOpenFolders();
    };

    /**
     * Updates the title and/or unread count of a node
     * @param type the type (MenuNodeType)
     * @param id the id
     * @param data a json array with the data for the node {title: '', 'unreadCount': 3}
     */
    Menu.prototype.updateNode = function(type, id, data){
        var $node = this._getNodeFromTypeAndId(type, id);
        
        if(data.title !== undefined){
            $node.children('.title').html(data.title);
        }

        if(data.undreadCount !== undefined){
            this._setUnreadCount(type, id, data.unreadCount);
        }
    };

    /**
     * Removes a node and its subnodes from the menu
     * @param type the type (MenuNodeType)
     * @param id the id     
     */
    Menu.prototype.removeNode = function(type, id){
        var $node = this._getNodeFromTypeAndId(type, id);
        $node.remove();
    };

    /**
     * Elements should only be set as hidden if the user clicked on a new entry
     * Then all all_read entries should be marked as hidden
     * This function is used to hide all the read ones if showAll is false,
     * otherwise shows all
     */
    Menu.prototype.triggerHideRead = function(){
        if(this._showAll){
            $(this._$root).find('.hidden').each(function(){
                $(this).removeClass('hidden');
            });
        } else {
            $(this._$root).find('.all_read').each(function(){
                if(!$(this).hasClass('hidden')){
                    $(this).addClass('hidden');
                }
            });                
        }
    };

    /**
     * Marks the current feed as all read
     */
    Menu.prototype.markCurrentFeedRead = function(){
        this._markRead(this._activeFeedType, this._activeFeedType);
    }

    /**
     * Sets the showAll value
     * @param showAll if true, all read folders and feeds are being shown
     * if false only unread ones are shown
     */
    Menu.prototype.setShowAll = function(showAll){
        this._showAll = showAll;
        this.triggerHideRead();
    };

    /**
     * Shortcut for toggling show all
     */
    Menu.prototype.toggleShowAll = function(){
        this.setShowAll(!this._showAll);
    };

    /**
     * Binds the menu on an existing menu
     * @param css Selector the selector to get the element with jquery
     */
    Menu.prototype.bindOn = function(cssSelector){
        var self = this;
        // remove mock elements
        this._$mockFolder = $('.mock.folder').detach();
        this._$mockFolder.removeClass('mock open');
        this._$mockFeed = $('.mock.feed').detach();
        this._$mockFeed.removeClass('mock');

        // bind menu
        this._$root = $(cssSelector);
        this._id = this._$root.data('id');
        this._$root.children('li').each(function(){
            self._bindMenuItem($(this));
        });
        this._bindDroppable(this._$root);
        this._$activeFeed = $('#feeds .active');
        this._activeFeedId = this._$activeFeed.data('id');
        this._activeFeedType = this._listItemToMenuNodeType(this._$activeFeed);
        
        this._updateUnreadCountAll();
    };

    /**
     * Binds the according handlers and reads in the meta data for each node
     * @param $listItem the jquery list element
     */
    Menu.prototype._bindMenuItem = function($listItem){        
        switch(this._listItemToMenuNodeType($listItem)){
            case MenuNodeType.Feed:
                this._bindFeed($listItem);
                break;
            case MenuNodeType.Folder:
                this._bindFolder($listItem);
                break;
            case MenuNodeType.Starred:
                this._bindStarred($listItem);
                break;
            case MenuNodeType.Subscriptions:
                this._bindSubscriptions($listItem);
                break;
            default:
                console.log('Found unknown MenuNodeType');
                console.log($listItem);
                break;
        }
    };

    /**
     * Binds event listeners to the folder and its subcontents
     * @param $listItem the jquery list element
     */
    Menu.prototype._bindFolder = function($listItem){
        var self = this;
        var id = $listItem.data('id');
        var $children = $listItem.children('ul').children('li');

        this._resetOpenFolders();

        // bind subitems
        $children.each(function(){
            self._bindMenuItem($(this));
        });

        // bind click listeners
        this._bindDroppable($listItem);
        this._bindDroppable($listItem.children('ul'));

        $listItem.children('.title').click(function(){
            self._load(MenuNodeType.Folder, id);
            return false;
        });

        $listItem.children('.collapsable_trigger').click(function(){
            self._toggleCollapse($listItem);
        });

        $listItem.children('.feeds_delete').click(function(){
            self._delete(MenuNodeType.Folder, id);
        });

        $listItem.children('.feeds_edit').click(function(){
            self._edit(MenuNodeType.Folder, id);
        });

        $listItem.children('.feeds_markread').click(function(){
            self._markRead(MenuNodeType.Folder, id);
        });
    };

    /**
     * Binds the callbacks for a normal feed
     * @param $listItem the jquery list element
     */
    Menu.prototype._bindFeed = function($listItem){
        var self = this;
        var id = $listItem.data('id');
        this._setUnreadCount(MenuNodeType.Feed, id, 
            this._getAndRemoveUnreadCount($listItem));

        $listItem.children('.title').click(function(){
            self._load(MenuNodeType.Feed, id);
            return false;
        });

        $listItem.children('.feeds_delete').click(function(){
            self._delete(MenuNodeType.Folder, id);
        });

        $listItem.children('.feeds_markread').click(function(){
            self._markRead(MenuNodeType.Folder, id);
        });

        $listItem.draggable({ 
            revert: true,
            stack: '> li',   
            zIndex: 1000,
            axis: 'y',
        });
    };

    /**
     * Binds the callbacks for the starred articles feed
     * @param $listItem the jquery list element
     */
    Menu.prototype._bindStarred = function($listItem){
        this._setUnreadCount(MenuNodeType.Starred, 0, 
            this._getAndRemoveUnreadCount($listItem));

        $listItem.children('.title').click(function(){
            self._load(MenuNodeType.Starred, id);
            return false;
        });
    };

    /**
     * Binds the callbacks for the new articles feed
     * @param $listItem the jquery list element
     */
    Menu.prototype._bindSubscriptions = function($listItem){
        this._setUnreadCount(MenuNodeType.Subscriptions, 0, 
            this._getAndRemoveUnreadCount($listItem));

        $listItem.children('.title').click(function(){
            self._load(MenuNodeType.Subscriptions, id);
            return false;
        });

        $listItem.children('.feeds_markread').click(function(){
            self._markRead(MenuNodeType.Folder, id);
        });
    };

    /**
     * Loads a new feed into the right content
     * @param type the type (MenuNodeType)
     * @param id the id
     */
    Menu.prototype._load = function(type, id){
        this._setActiveFeed(type, id);
        this._items.load(type, id);
    };

    /**
     * Deletes a feed
     * @param type the type (MenuNodeType)
     * @param id the id
     */
    Menu.prototype._delete = function(type, id){
        // TODO:
    };

    /**
     * Shows the edit window for a feed
     * @param type the type (MenuNodeType)
     * @param id the id
     */
    Menu.prototype._edit = function(type, id){
        // TODO:
    };

    /**
     * Marks all items of a feed as read
     * @param type the type (MenuNodeType)
     * @param id the id
     */
    Menu.prototype._markRead = function(type, id){
        // make sure only feeds get past
        switch(type){

            case MenuNodeType.Folder:
                var $folder = this._getNodeFromTypeAndId(type, id);
                $folder.children('ul').children('li').each(function(){
                    var childData = this._getIdAndTypeFromNode($(this));
                    this._markRead(childData.type, childData.id);
                });
                break;

            case MenuNodeType.Subscriptions:
                this._root.children('li').each(function(){
                    var childData = this._getIdAndTypeFromNode($(this));
                    this._markRead(childData.type, childData.id);
                });
                break;

            case MenuNodeType.Feed:
                var data = {
                    feedId: id,
                    mostRecentItemId: this._items.getMostRecentItemId(id)
                };

                $.post(OC.filePath('news', 'ajax', 'setallitemsread.php'), data, function(jsonData) {
                    if(jsonData.status == 'success'){
                        this._items.markAllRead(type, id);
                        this._updateUnreadCountAll();
                    } else {
                        OC.dialogs.alert(jsonData.data.message, t('news', 'Error'));
                    }
                });
                break;
        }
    };

    /**
     * Requests an update for unreadCount for all feeds and folders
     */
    Menu.prototype._updateUnreadCountAll = function() {
        var self = this;
        $.post(OC.filePath('news', 'ajax', 'feedlist.php'),function(jsonData){
            if(jsonData.status == 'success'){
                var feeds = jsonData.data;
                for (var i = 0; i<feeds.length; i++) {
                    self._updateUnreadCount(feeds[i]['id'], feeds[i]['url'], feeds[i]['folderid']);
                }
            } else {
                OC.dialogs.alert(jsonData.data.message, t('news', 'Error'));
            }
        });
    };

    /**
     * Request unreadCount for one feed
     * @param feedId the id of the feed
     * @param feedUrl the url of the feed that should be updated
     * @param folderId the folderId fo the folder the feed is in
     */
    Menu.prototype._updateUnreadCount = function(feedId, feedUrl, folderId) {
        var self = this;
        var data = {
            'feedid':feedId, 
            'feedurl':feedUrl, 
            'folderid':folderId
        };
        $.post(OC.filePath('news', 'ajax', 'updatefeed.php'), data, function(jsondata){
            if(jsondata.status == 'success'){
                var newUnreadCount = jsondata.data.unreadcount;
                // FIXME: starred items should also be set
                self._setUnreadCount(MenuNodeType.Feed, feedId, newUnreadCount);
            } else {
                OC.dialogs.alert(jsonData.data.message, t('news', 'Error'));
            }
        });
    };

    /**
     * Toggles the child ul of a listitem
     * @param $listItem the jquery list element
     */
    Menu.prototype._toggleCollapse = function($listItem){
        $listItem.toggleClass('open');
        $listItem.children('.collapsable_trigger').toggleClass('triggered');
        $listItem.children('ul').toggle();
    };

    /**
     * Sets the active feed to a new feed or folder
     * @param type the type (MenuNodeType)
     * @param id the id
     */
    Menu.prototype._setActiveFeed = function(type, id){
        var $oldFeed = this._$activeFeed;
        var $newFeed = this._getNodeFromTypeAndId(type, id);
        $oldFeed.removeClass('.active');
        $newFeed.addClass('.active');
        this._$activeFeed = $newFeed;
        this._activeFeedId = id;
        this._activeFeedType = type;
    };


    /**
     * Used when iterating over the menu. The unread count is being extracted,
     * the dom element is removed and the count is being returned
     * @param $listItem the jquery list element
     * @return the count of unread items
     */
    Menu.prototype._getAndRemoveUnreadCount = function($listItem){
        var $unreadCounter = $listItem.children('.unread_items_counter');
        var unreadCount = parseInt($unreadCounter.html());
        $unreadCounter.remove();
        return unreadCount;
    };

    /**
     * Returns the jquery element for a type and an id
     * @param type the type (MenuNodeType)
     * @param id the id
     * @return the jquery node
     */
    Menu.prototype._getNodeFromTypeAndId = function(type, id) {
        if(id === 0){
            return this._$root;
        }

        if(type === MenuNodeType.Starred || type === MenuNodeType.Subscriptions){
            return $('.' + this._menuNodeTypeToClass(type));
        } else {
            return $('.' + this._menuNodeTypeToClass(type) + '[data-id="' + id + '"]');
        }
    };

    /**
     * Returns id and type from a listnode
     * @param $listItem the list item
     * @return a json array with the id and type for instance { id: 1, type: MenuNodeType.Feed}
     */
    Menu.prototype._getIdAndTypeFromNode = function($listItem) {
        return {
            id: $listItem.data('id'),
            type: this._listItemToMenuNodeType($listItem),
        };
    };

    /**
     * Returns the MenuNodeType of a list item
     * @param $listItem the jquery list element
     * @return the MenuNodeType of the jquery element
     */
    Menu.prototype._listItemToMenuNodeType = function($listItem){
        if($listItem.hasClass(this._menuNodeTypeToClass(MenuNodeType.Feed))){
            return MenuNodeType.Feed;
        } else if($listItem.hasClass(this._menuNodeTypeToClass(MenuNodeType.Folder))){
            return MenuNodeType.Folder;
        } else if($listItem.hasClass(this._menuNodeTypeToClass(MenuNodeType.Starred))){
            return MenuNodeType.Starred;
        } else if($listItem.hasClass(this._menuNodeTypeToClass(MenuNodeType.Subscriptions))){
            return MenuNodeType.Subscriptions;
        }
    };

    /**
     * Returns the classname of the MenuNodeType
     * @param menuNodeType the type of the menu node
     * @return the class of the MenuNodeType
     */
    Menu.prototype._menuNodeTypeToClass = function(menuNodeType){
        return MenuNodeTypeClass[menuNodeType];
    };

    /**
     * When feeds are moved to different folders and in the beginning, we 
     * have to check for folders with children and add the appropriate 
     * collapsable classes to give access to the collapasable button
     */
    Menu.prototype._resetOpenFolders = function(){
        var $folders = $('.folder');
        $folders.each(function(){
            var $children = $(this).children('ul').children('li');
            if($children.length > 0){
                $(this).addClass('collapsable');
            } else {
                $(this).removeClass('collapsable');
            }
        });
    };

    /**
     * Sets the unread count and handles the appropriate css classes
     * @param type the type (MenuNodeType)
     * @param id the id
     * @param unreadCount the count of unread items
     */
    Menu.prototype._setUnreadCount = function(type, id, unreadCount){
        var $node = this._getNodeFromTypeAndId(type, id);
        var currentUnreadCount;

        // get the node and the storred values
        switch(type){
            case MenuNodeType.Feed:
                currentUnreadCount = this._unreadCount.Feed[id];
                this._unreadCount.Feed[id] = unreadCount;
                break;

            case MenuNodeType.Folder:
                currentUnreadCount = this._unreadCount.Folder[id];
                this._unreadCount.Folder[id] = unreadCount;
                break;

            case MenuNodeType.Starred:
                currentUnreadCount = this._unreadCount.Starred;
                this._unreadCount.Starred = unreadCount;
                break;

            case MenuNodeType.Subscriptions:
                currentUnreadCount = this._unreadCount.Subscriptions;
                this._unreadCount.Subscriptions = unreadCount;
                break;

            default:
                console.log('Found unknown MenuNodeType');
                break;
        }

        if(unreadCount === 0){
            $node.addClass('all_read');
        } 

        if(currentUnreadCount !== undefined && currentUnreadCount === 0
            && unreadCount > 0){
            $node.removeClass('all_read hidden');  
        }

    };

    /**
     * Binds a droppable on the element
     * @param $elem the element that should be set droppable
     */
    Menu.prototype._bindDroppable = function($elem){
        var self = this;
        $elem.droppable({
            accept: '.feed',
            hoverClass: 'dnd_over',
            greedy: true,
            drop: function(event, ui){
                var $dropped = $(this);
                var $dragged = $(ui.draggable);

                var feedId = parseInt($dragged.data('id'));
                var folderId = parseInt($dropped.data('id'));

                if($dropped.hasClass(self._menuNodeTypeToClass(MenuNodeType.Folder))){
                    $dropped.children('ul').append($dragged[0]);
                } else {
                    $dropped.append($dragged[0]);
                }

                self._resetOpenFolders();
                self._moveFeedToFolder(feedId, folderId);
            }
        });
    };

    /**
     * Moves a feed to a folder
     * @param feedId the feed that should be moved (can only be a feed)
     * @param id the id of the folder where it should be moved, 0 for root
     */
    Menu.prototype._moveFeedToFolder = function(feedId, folderId){
        data = {
            feedId: feedId,
            folderId: folderId
        };

        $.post(OC.filePath('news', 'ajax', 'movefeedtofolder.php'), data, function(jsonData) {
            if(jsonData.status !== 'success'){
                OC.dialogs.alert(jsonData.data.message, t('news', 'Error'));
            }
        });
    };


})();