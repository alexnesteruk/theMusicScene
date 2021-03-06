<hgroup>
  <h2 data-bind="text: 'Viewing: ' + viewingPlayList().name()"></h2>
</hgroup>

<section data-bind="css: { active: selectedSongs().length > 0 }">
  <h3 data-bind="text: selectedSongs().length + ' songs selected'"></h3>
  <button class="deselect" title="Deselect songs." data-bind="click: removeAllSelected">deselect all</button>
  <!-- ko if: viewingPlayList().searchplaylist === undefined -->
  <button class="remove" title="Remove selected songs." data-bind="click: removeSelectedSongsFromPlaylist">remove all</button>
  <!-- /ko -->
</section>

<div class="searchToggle switch">
  <input type="radio" class="switch-input" name="listSource" id="playlistsearch" value="playlistsearch" data-bind="checked: listSource">
  <label for="playlistsearch" class="switch-label switch-label-off" title="Search your playlist.">Playlist</label>
  <input type="radio" class="switch-input" name="listSource" id="turntablesearch" value="turntablesearch" data-bind="checked: listSource">
  <label for="turntablesearch" class="switch-label switch-label-on" title="Search Turntable.">Turntable</label>
  <span class="switch-selection"></span>
  <input class="searchInput" type="text" placeholder="Search Turntable" data-bind="value: searchQuery, valueUpdate:'afterkeydown', css: { active: listSource() === 'turntablesearch' }">
</div>

<table data-bind="dataTable: { data: songList, options: tableOptions }">
</table>

<menu data-bind='template: { name: "playlists-template", data: $data }, css: { open: playListsOpen }'></menu>