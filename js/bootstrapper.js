/**
 * Extension's bootstrapper functions
 */
(function () {
  var songBoardHtml;
  /**
   * Scrapes page for templates loaded by content script and reloads them to privide acess in the TT sandbox
   * @return {[type]} [description]
   */
  function getTemplates () {
    var templates = [];

    $("script[type='text/html']").each(function(i, el){
      var $t = $(el),
          src = $t.attr("src"),
          id = $t.attr("id");

      $t.remove();

      templates.push($.get(src, function (payload, status, xhr) {
        if (id === "panelBase") {
          $("#turntable .roomView").append(payload);
        } else if (id === "songBoard") {
          songBoardHtml = payload;
        } else {
          $("body").append("<script id='" + id + "-template' type='text/html'>" + payload + "</script>");
        }
      }));
    });

    return templates;
  }

  // generate array of deferred objects for playlist requests
  function compilePlaylistRequests (playlists) {
    var reqs = [];

    for(var i in playlists) {
      var returnEvent = tms.events.ext.api.playlist + playlists[i].name.split(' ').join('_');

      reqs.push(eventBus.request(
        tms.events.tt.api.playlist,
        {
          api: "playlist.all",
          playlist_name: playlists[i].name,
          minimal: false
        },
        returnEvent
      ));        
    }

    return reqs;      
  }

  /**
   * Initializes the extension in the TT sandbox
   */
  function buildModels (data) {
    // build up application models
    var models = {
      tmsModel: {
        tt: data,
        eventBus: eventBus,
        room: null,
        roomInfo: null
      },
      libraryModel: {
        eventBus: eventBus,
        playlistData: [],
        tableOptions: {
          "sScrollY": "336px",
          "bScrollCollapse": true,
          "bPaginate": false,
          "iTabIndex": 1, // keybaord navigation for column sorting (tab > enter)
          "sDom": '<"songListHead"if>tS',
          "aoColumnDefs": [
            // column names
            { "sTitle": "#", "aTargets": [ 0 ] },
            { "sTitle": "Artist", "aTargets": [ 1 ] },
            { "sTitle": "Song", "aTargets": [ 2 ] },
            { "sTitle": "Album", "aTargets": [ 3 ] },
            { "sTitle": "Genre", "aTargets": [ 4 ] },
            { "sTitle": "Length", "aTargets": [ 5 ] },
            // column widths
            { "sWidth": "3%", "aTargets": [ 0 ] },
            { "sWidth": "19%", "aTargets": [ 1 ] },
            { "sWidth": "28%", "aTargets": [ 2 ] },
            { "sWidth": "20%", "aTargets": [ 3 ] },
            { "sWidth": "19%", "aTargets": [ 4 ] },
            { "sWidth": "6%", "aTargets": [ 5 ] },
            { "sWidth": "3%", "aTargets": [ 6 ] },
            //column classes
            { "sClass": "pos", "aTargets": [ 0 ] },
            { "sClass": "artist", "aTargets": [ 1 ] },
            { "sClass": "songname", "aTargets": [ 2 ] },
            { "sClass": "album", "aTargets": [ 3 ] },
            { "sClass": "genre", "aTargets": [ 4 ] },
            { "sClass": "length", "aTargets": [ 5 ] },
            { "sClass": "actions", "aTargets": [ 6 ] },
            // sort and filter options
            { "aDataSort": [ 1, 3 ], "aTargets": [ 1 ] }, // when sorting artist, secondary sort is on album
            { "aDataSort": [ 5, 1 ], "aTargets": [ 5 ] }, // when sorting genre, secondary sort is on artist
            { "bSearchable": false, "aTargets": [ 0 ] },  // prevent filtering on # column
            { "sType": "numeric", "aTargets": [ 0 ] },    // enabled numeric sort on # column
            { "sType": "html", "aTargets": [ 6 ] }        // render buttons as html
          ],
          "bAutoWidth" : false
        }
      }
    },
    ttPlaylists,
    activePlaylist;

    // initial requests
    var roomReq = {
          api: "room.info",
          roomid: data.roomId,
          section: data.section,
          userid: data.userId,
          userauth: data.userAuth
        },
        playlistReq = { api: "playlist.list_all" };

    // get room info and user playlists
    try {
      // request room info and playlists
      $.when(
          eventBus.request(
                      tms.events.tt.api.room,
                      roomReq,
                      tms.events.ext.api.room
                      ),
          eventBus.request(
                      tms.events.tt.api.playlists,
                      playlistReq,
                      tms.events.ext.api.playlists
        ))
        .then(function(roomInfo, playlists) {
          models.tmsModel.roomInfo = roomInfo;
          ttPlaylists = [];

          // active playlist needs to be the last so it is last requested
          //  because the TT api auto-activates playlists upon request
          for (var i in playlists.list) {
            if (playlists.list[i].active) {
              activePlaylist = playlists.list[i];
            } else {
              ttPlaylists.push(playlists.list[i]);
            }
          }

          // compile requests and return $.when()
          var loadLists = compilePlaylistRequests(ttPlaylists);
          return $.when.apply($, loadLists);
        }, function(err){ console.log(err); })  
        .then(function() {
          // compile playlist data 
          for (var i in arguments) {

            // only if the argument is a playlist
            if (arguments[i].list) {
              models.libraryModel.playlistData.push({
                list: arguments[i].list,
                name: ttPlaylists[i].name,
                active: ttPlaylists[i].active
              });
            }
          }

          // get active playlist last
          return eventBus.request(
            tms.events.tt.api.playlist,
            {
              api: "playlist.all",
              playlist_name: activePlaylist.name,
              minimal: false
            },
            tms.events.ext.api.playlist + activePlaylist.name.split(' ').join('_')
          );
        }, function(err){ console.log(err); })
        .done(function (playlist) {

          // add active list to model data
          models.libraryModel.playlistData.push({
            list: playlist.list,
            name: activePlaylist.name,
            active: activePlaylist.active
          });

          init(models); 
        })
        .fail(function(err){ console.log(err); });
    } catch (e) {
      console.log("API Exception!");
      console.log(e);
    }        
  }

  /**
   * Create and bind application view model
   * @param  {object} model    [app model]
   */
  function init (models) {
    models.tmsModel.currentSong = new tms.viewmodels.CurrentSongViewModel(models.tmsModel.roomInfo.room);
    models.tmsModel.library = tms.factories.libraryFactory(models.libraryModel);

    // create library and bind to view
    tms.app = tms.factories.tmsFactory(models.tmsModel);   
   
    $("#bigboard").livequery(function () {
      $(this).append(songBoardHtml);  
    
      ko.applyBindings(tms.app);
      console.log("tms ready");   
    });
  }

  function onReady () {
    eventBus.subscriptions = [];

    $.when.apply(null, getTemplates())
      .then(function () {
        return eventBus.request(tms.events.tt.initInfo, {}, tms.events.ext.initInfo);
      })
      .done(buildModels);
  }

  var eventBus = new tms.EventBus([{ name: tms.events.ext.registered, callback: onReady }]);
}());

