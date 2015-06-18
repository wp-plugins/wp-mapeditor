(function (w) {	

	var mapStyle = [{"featureType": 'landscape', "elementType": 'labels', "stylers": [{ "visibility": "off" }] },{"featureType": 'poi.business', "elementType": 'labels', "stylers": [{ "visibility": "off" }] }];
	var flatStyle = [{"featureType":"all","elementType":"labels","stylers":[{"visibility":"on"}]},{"featureType":"landscape","elementType":"all","stylers":[{"visibility":"on"},{"color":"#f3f4f4"}]},{"featureType":"landscape.man_made","elementType":"geometry","stylers":[{"weight":0.9},{"visibility":"off"}]},{"featureType":"poi.park","elementType":"geometry.fill","stylers":[{"visibility":"off"},{"color":"#83cead"}]},{"featureType":"road","elementType":"all","stylers":[{"visibility":"on"},{"color":"#ffffff"}]},{"featureType":"road","elementType":"labels","stylers":[{"visibility":"off"}]},{"featureType":"road.highway","elementType":"all","stylers":[{"visibility":"on"},{"color":"#fee379"}]},{"featureType":"road.arterial","elementType":"all","stylers":[{"visibility":"on"},{"color":"#fee379"}]},{"featureType":"water","elementType":"all","stylers":[{"visibility":"on"},{"color":"#7fc8ed"}]}];
	var darkStyle = [{"featureType":"all","elementType":"labels.text.fill","stylers":[{"saturation":36},{"color":"#000000"},{"lightness":40}]},{"featureType":"all","elementType":"labels.text.stroke","stylers":[{"visibility":"on"},{"color":"#000000"},{"lightness":16}]},{"featureType":"all","elementType":"labels.icon","stylers":[{"visibility":"off"}]},{"featureType":"administrative","elementType":"geometry.fill","stylers":[{"color":"#000000"},{"lightness":20}]},{"featureType":"administrative","elementType":"geometry.stroke","stylers":[{"color":"#000000"},{"lightness":17},{"weight":1.2}]},{"featureType":"landscape","elementType":"geometry","stylers":[{"color":"#000000"},{"lightness":20}]},{"featureType":"poi","elementType":"geometry","stylers":[{"color":"#000000"},{"lightness":21}]},{"featureType":"road.highway","elementType":"geometry.fill","stylers":[{"color":"#000000"},{"lightness":17}]},{"featureType":"road.highway","elementType":"geometry.stroke","stylers":[{"color":"#000000"},{"lightness":29},{"weight":0.2}]},{"featureType":"road.arterial","elementType":"geometry","stylers":[{"color":"#000000"},{"lightness":18}]},{"featureType":"road.local","elementType":"geometry","stylers":[{"color":"#000000"},{"lightness":16}]},{"featureType":"transit","elementType":"geometry","stylers":[{"color":"#000000"},{"lightness":19}]},{"featureType":"water","elementType":"geometry","stylers":[{"color":"#000000"},{"lightness":17}]}];
  var neutralBlueStyle = [{"featureType":"water","elementType":"geometry","stylers":[{"color":"#193341"}]},{"featureType":"landscape","elementType":"geometry","stylers":[{"color":"#2c5a71"}]},{"featureType":"road","elementType":"geometry","stylers":[{"color":"#29768a"},{"lightness":-37}]},{"featureType":"poi","elementType":"geometry","stylers":[{"color":"#406d80"}]},{"featureType":"transit","elementType":"geometry","stylers":[{"color":"#406d80"}]},{"elementType":"labels.text.stroke","stylers":[{"visibility":"on"},{"color":"#3e606f"},{"weight":2},{"gamma":0.84}]},{"elementType":"labels.text.fill","stylers":[{"color":"#ffffff"}]},{"featureType":"administrative","elementType":"geometry","stylers":[{"weight":0.6},{"color":"#1a3541"}]},{"elementType":"labels.icon","stylers":[{"visibility":"off"}]},{"featureType":"poi.park","elementType":"geometry","stylers":[{"color":"#2c5a71"}]}];

	/**************************************************************************************************
			GOOGLE MAPS
			FUNCTIONS & DATA
	**************************************************************************************************/

	jQuery.extend(w.gmap, {
		statuses: [ 'CHECKED', 'MUST', 'OK', 'MISLOCATED', 'DRAFT', 'UNAVAILABLE' ],
		types: [ 'ENTERTAINMENT', 'HOSPITAL', 'HOTEL', 'HOUSE', 'LANDSCAPE', 'INDUSTRIAL', 'MILITARY', 'OFFICE', 'RELIGION', 'SCHOOL', 'UNSPECIFIED', 'RUIN', 'UNAVAILABLE' ],
		periods: [ 'ANYTIME', 'SPRING', 'SUMMER', 'AUTUMN', 'WINTER' ],
		difficulties: [ 1, 2, 3, 4, 5 ],
		ratings: [ 1, 2, 3, 4, 5 ]
	});

	var map;
	var icon_pin;
	var icon_pin_current;
	var icon_pin_selected;
	var icon_pin_exclamation;
	var icon_pin_draggable;
	var icons_status = {};
	var icons_type = {};
	var icons_period = {};
	var size = 20;
	var scaledSize = 20;
	var localMarker = null;
	var imageMarkers = [];

	w.gmap.onInit = function(div, init, click) {

		var roadMap = new google.maps.StyledMapType(mapStyle, { name: "Futsu"}  );
		var darkMap = new google.maps.StyledMapType(darkStyle, { name: "Dark"}  );
		var flatMap = new google.maps.StyledMapType(flatStyle, { name: "Flat"}  );
		var neutralBlueMap = new google.maps.StyledMapType(neutralBlueStyle, { name: "Blue"}  );

		google.maps.event.addDomListener(window, 'load', function () {
			map = new google.maps.Map(document.getElementById(div), {
				mapTypeId: 'futsu',
				center: { lat: 35.682839, lng: 139.682600 },
				zoom: 8,
				minZoom: 2,
				panControl: false,
				zoomControl: false,
				scaleControl: false,
				mapTypeControlOptions: {
					mapTypeIds: ['futsu', google.maps.MapTypeId.TERRAIN, google.maps.MapTypeId.SATELLITE, 'dark_map_style', 'flat_map_style', 'neutral_blue_style' ]
				}
			});
			map.mapTypes.set('futsu', roadMap);
			map.mapTypes.set('dark_map_style', darkMap);
			map.mapTypes.set('flat_map_style', flatMap);
			map.mapTypes.set('neutral_blue_style', neutralBlueMap);

			google.maps.event.addListener(map, 'click', function(e) {
				click(e.latLng.lat(), e.latLng.lng());
			});
			icon_pin_current = {
				url: w.gmap.plugdir + 'icons/current.png',
				anchor: new google.maps.Point(10, 10),
				size: new google.maps.Size(size, size),
				scaledSize: new google.maps.Size(scaledSize, scaledSize)
			};
			icon_pin = {
				url: w.gmap.plugdir + 'icons/pin.png',
				anchor: new google.maps.Point(10, 10),
				size: new google.maps.Size(size, size),
				scaledSize: new google.maps.Size(scaledSize, scaledSize)
			};
			icon_pin_selected = {
				url: w.gmap.plugdir + 'icons/selected.png',
				anchor: new google.maps.Point(10, 10),
				size: new google.maps.Size(size, size),
				scaledSize: new google.maps.Size(scaledSize, scaledSize)
			};
			icon_pin_exclamation = {
				url: w.gmap.plugdir + 'icons/exclamation.png',
				anchor: new google.maps.Point(10, 10),
				size: new google.maps.Size(size, size),
				scaledSize: new google.maps.Size(scaledSize, scaledSize)
			};
			icon_pin_draggable = {
				url: w.gmap.plugdir + 'icons/draggable.png',
				anchor: new google.maps.Point(10, 10),
				size: new google.maps.Size(size, size),
				scaledSize: new google.maps.Size(scaledSize, scaledSize)
			};
			for (var i in w.gmap.statuses) {
				var st = w.gmap.statuses[i];
				icons_status[st] = {
					url: w.gmap.plugdir + 'icons/' + st + '.png',
					anchor: new google.maps.Point(10, 10),
					size: new google.maps.Size(size, size),
					scaledSize: new google.maps.Size(scaledSize, scaledSize)
				};
			}
			for (var i in w.gmap.types) {
				var tp = w.gmap.types[i];
				icons_type[tp] = {
					url: w.gmap.plugdir + 'icons/' + tp + '.png',
					size: new google.maps.Size(24, 24),
					scaledSize: new google.maps.Size(24, 24)
				};
			}
			for (var i in w.gmap.periods) {
				var pe = w.gmap.periods[i];
				icons_period[pe] = {
					url: w.gmap.plugdir + 'icons/' + pe + '.png',
					size: new google.maps.Size(24, 24),
					scaledSize: new google.maps.Size(24, 24)
				};
			}
			init();
		});
	}

	w.gmap.getCenter = function() {
		var latlng = map.getCenter();
		return latlng.lat() + "," + latlng.lng();
	}

	w.gmap.show = function(location) {
		location.visible = true;
		location.marker.setVisible(true);
	}

	w.gmap.hide = function(location) {
		location.visible = true;
		location.marker.setVisible(false);
	}

	// Mode: 'type', 'status', 'period'
	// Value: Depends on the type
	w.gmap.setLocationIcon = function(location, mode) {
		if (!location) {
			console.debug("Location is null.");
		}
		else if (location.selected) {
			location.marker.setIcon(icon_pin_selected);
		}
		else if (mode === 'status' && icons_status[location.status]) {
			location.marker.setIcon(icons_status[location.status]);
		}
		else if (mode === 'type' && icons_type[location.type]) {
			location.marker.setIcon(icons_type[location.type]);
		}
		else if (mode === 'period') {
			if (icons_period[location.period])
				location.marker.setIcon(icons_period[location.period]);
			else
				location.marker.setIcon(icon_pin);
		}
		else {
			location.marker.setIcon(icon_pin_exclamation);
		}
	}

	w.gmap.bounce = function(location) {
		location.marker.setAnimation(google.maps.Animation.BOUNCE);
		setTimeout(function() {
			location.marker.setAnimation(null); 
		}, 750);
	}

	w.gmap.setDraggable = function(location, mode, isTrue, fn) {
		if (!location) {
			console.debug("Location is null.");
		}
		if (isTrue) {
			location.marker.setIcon(icon_pin_draggable);
			location.marker.listenerDrag = google.maps.event.addListener(location.marker, 'dragend', function() {
				var latlng = location.marker.getPosition();
				fn(latlng.lat() + "," + latlng.lng(), latlng);
			});
		}
		else {
			w.gmap.setLocationIcon(location, mode);
			google.maps.event.removeListener(location.marker.listenerDrag);
		}
		location.marker.setDraggable(isTrue);
	}

	w.gmap.update = function(location, mode) {
		location.marker.setTitle(location.name);
		location.marker.setPosition(location.latlng);
		w.gmap.setLocationIcon(location, mode);
	}

	w.gmap.goTo = function(location, lng) {
		if (location == null)
			return;
		if (lng != null) {
			var pos = new google.maps.LatLng(location, lng, true);
			map.panTo(pos);
		}
		else
			map.panTo(location.marker.getPosition());
	}

	w.gmap.setCurrentUserPost = function(lat, lng) {
		var pos = new google.maps.LatLng(lat, lng, true);
		if (!lat) {
			localMarker.setMap(null);
			localMarker = null;
			return;
		}
		if (!localMarker) {
			localMarker = new google.maps.Marker({
				position: pos,
				map: map
			});
			localMarker.setIcon(icon_pin_current);
		}
		else {
			localMarker.setPosition(pos);
		}
		map.panTo(pos);
	}

	w.gmap.resetImages = function() {
		for (var c in imageMarkers) {
			imageMarkers[c].onRemove();
		}
		imageMarkers = [];
	}

	w.gmap.addImage = function(id, img, title, url, lat, lng) {
		var imageMarker = new RichMarker({
			shadow: "none",
			flat: true,
			position: new google.maps.LatLng(lat, lng),
			map: map,
			content: '<div class="image-marker">' +
				'<a target="_blank" title="' + title + '" href="' + url + '"><img src="' + img + '" /></a></div>'
		});
		imageMarkers.push(imageMarker);
	}

	w.gmap.add = function(location, mode, mouseover, mouseout, click) {
		location.marker = new google.maps.Marker({
			position: location.latlng,
			map: map, 
			title: location.name,
			clickable: true
		});
		w.gmap.setLocationIcon(location, mode);
		location.visible = true;
		google.maps.event.addListener(location.marker, 'mouseover', function() {
			mouseover(location);
		});
		google.maps.event.addListener(location.marker, 'mouseout', function() {
			mouseout(location);
		});
		google.maps.event.addListener(location.marker, 'click', function() {
			map.panTo(location.marker.getPosition());
			click(location);
		});
	}

	w.gmap.fitbounds = function(locations) {
		var bounds = new google.maps.LatLngBounds();;
		for (var i in locations) {
			if (locations[i] && locations[i].latlng) {
				bounds.extend(locations[i].latlng);
			}
			else {
				console.debug("Location and latlng not found.", i, locations[i]);
			}
		}
		map.fitBounds(bounds);
	}

	w.gmap.remove = function(location) {
		location.marker.setMap(null);
	}

}(window));
