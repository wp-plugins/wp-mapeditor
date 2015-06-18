(function () {

	"use strict";

	angular.module('MapEditor', [ "isteven-multi-select", "angular-ladda" ]);
	angular.module('MapEditor')
	.controller("EditorCtrl", EditorCtrl)
	.config(['$httpProvider', function ($httpProvider) {
		// Intercept POST requests, convert to standard form encoding
		$httpProvider.defaults.headers.post["Content-Type"] = "application/x-www-form-urlencoded";
		$httpProvider.defaults.transformRequest.unshift(function (data, headersGetter) {
			var key, result = [];
			for (key in data) {
				if (data.hasOwnProperty(key)) {
				result.push(encodeURIComponent(key) + "=" + encodeURIComponent(data[key]));
				}
			}
			return result.join("&");
		});
	}]);

	/**************************************************************************************************
			VENDOR FUNCTIONS
	**************************************************************************************************/

	function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
		var R = 6371; // Radius of the earth in km
		var dLat = deg2rad(lat2-lat1);  // deg2rad below
		var dLon = deg2rad(lon2-lon1); 
		var a = 
		Math.sin(dLat/2) * Math.sin(dLat/2) +
		Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
		Math.sin(dLon/2) * Math.sin(dLon/2); 
		var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
		var d = R * c; // Distance in km
		return d;
	}

	function deg2rad(deg) {
		return deg * (Math.PI / 180)
	}

	/**************************************************************************************************
			EDITOR CONTROLLER
	**************************************************************************************************/

	function EditorCtrl($scope, $location, $timeout, $filter, $log, $http, $q, $interval) {
		$scope.maps = [];
		$scope.selectedMaps = [];
		$scope.mostRecentMapId = [];
		$scope.locations = {};
		$scope.locationsCount = 0;
		$scope.gmapLoaded = false;
		$scope.displayMode = 'status';
		$scope.isFitBounded = false;
		$scope.isAddingLocation = false;
		$scope.isEditingLocation = false;
		$scope.isSavingLocation = false;
		$scope.isLoadingMap = false;
		$scope.mapSelectMode = 'single'; // single, multiple
		$scope.gmap = window.gmap;

		$scope.constants = { 
			statuses: gmap.statuses,
			periods: gmap.periods,
			types: gmap.types,
			difficulties: gmap.difficulties,
			ratings: gmap.ratings
		};

		// Editor
		$scope.editor = {
			hoveredLocation: null,
			selectedLocation: null,
			editLocation: null, // location being edited
			distanceFromSelected: null,
			isAutoTracking: false
		};

		// Import / Export
		$scope.ie = {
			isImporting: true,
			isExporting: true,
			isWorking: false,
			currentIndex: null,
			file: null,
			status: null,
			type: null,
			locations: null,
			mapId: null
		};

		/**************************************************************************************************
			LOAD MAPS
		**************************************************************************************************/	

		function loadMaps() {
			$http.post(ajaxurl, { 
				'action': 'load_maps'
			}).success(function (reply) {
				var maps = [];
				var data = angular.fromJson(reply.data);
				angular.forEach(data, function (m) {
					maps.push({ id: m.id, name: m.name, ticked: m.ticked });
					if (m.ticked) {
						$scope.mapSelect(m);
					}
				});
				$scope.maps = maps;
			}).error(function (reply, status, headers) {
				$log.error({ reply: reply });
			});
		}

		function getMap(id) {
			for (var i in $scope.maps) {
				if (parseInt($scope.maps[i].id) === parseInt(id)) {
					return $scope.maps[i];
				}
			}
			return null;
		}

		function mapClear(map) {
			for (var i in $scope.locations) {
				var loc = $scope.locations[i];
				if (loc && (!map || parseInt(loc.mapId) === parseInt(map.id))) {
					gmap.remove(loc);
					delete $scope.locations[i];
					$scope.locationsCount--;
				}
			}
		}

		$scope.toggleSelectMode = function () {
			if (!$scope.gmap.multimaps) {
				jQuery('#wpme-modal-pro-only').modal('show');
				return;
			}
			if ($scope.mapSelectMode === 'single')
				$scope.mapSelectMode = 'multiple';
			else
				$scope.mapSelectMode = 'single';
		}

		$scope.mapSelect = function (map) {
			if ($scope.mapSelectMode === 'single' && $scope.mostRecentMapId == map.id)
				return;
			var map = map;
			$scope.isLoadingMap = true;
			if ($scope.mapSelectMode === 'single') {
				mapClear();
			}
			else if ($scope.mapSelectMode === 'multiple' && !map.ticked) {
				mapClear(map);
			}
			if (!$scope.locationsCount) {
				$scope.isFitBounded = false;
			}
			if (map.ticked) {
				$http.post( ajaxurl, {
					action: 'load_locations',
					term_id: map.id
				}).success(function (reply) {
					$scope.mostRecentMapId = map.id;
					var data = angular.fromJson(reply.data);
					for (var i in data) {
						var m = data[i];
						updateLocation(m, map);
					}
					if (!$scope.isFitBounded && data.length > 0) {
						$scope.isFitBounded = true;
						gmap.fitbounds($scope.locations);
					}
					$scope.isLoadingMap = false;
				}).error(function (reply, status, headers) {
					$log.error({ reply: reply });
					$scope.isLoadingMap = false;
				});
			}
			else {
				$scope.isLoadingMap = false;
			}
		};

		/**************************************************************************************************
			ADD LOCATION
		**************************************************************************************************/

		// Display the popup
		$scope.onAddLocationClick = function () {
			mapOnClick();
			$scope.isAddingLocation = true;
			$scope.isEditingLocation = false;
			$scope.editor.editLocation = {
				name: "",
				description: "",
				coordinates: roundCoordinates(gmap.getCenter()),
				status: "DRAFT",
				type: "UNSPECIFIED",
				period: "ANYTIME",
				difficulty: null,
				rating: null,
				mapId: $scope.mostRecentMapId
			};
			jQuery('#wpme-modal-location').modal('show');
		}

		// Actually modify the location
		$scope.addLocation = function () {
			var deferred = $q.defer();
			$scope.isSavingLocation = true;
			$http.post(ajaxurl, { 
				'action': 'add_location',
				'location': angular.toJson($scope.editor.editLocation)
			}).success(function (reply) {
				$scope.isSavingLocation = false;
				var reply = angular.fromJson(reply);
				if (reply.success) {
					updateLocation(reply.data);
					jQuery('#wpme-modal-location').modal('hide');
					gmap.goTo($scope.locations[reply.data.id]);
					deferred.resolve($scope.locations[reply.data.id]);
				}
				else {
					jQuery('#wpme-modal-location').modal('hide');
					$log.warn({ reply: reply });
					deferred.reject(reply);
				}
			}).error(function (reply, status, headers) {
				jQuery('#wpme-modal-location').modal('hide');
				$log.error({ reply: reply });
				deferred.reject(reply);
			});
			return deferred.promise;
		};

		/**************************************************************************************************
			EDIT OR DELETE LOCATION
		**************************************************************************************************/

		// Display the popup
		$scope.onEditLocationClick = function () {
			if (!$scope.editor.selectedLocation)
				return;
			$scope.isEditingLocation = true;
			$scope.isAddingLocation = false;
			copyEditLocation();
			jQuery('#wpme-modal-location').modal('show');
		}

		// Actually modify the location
		$scope.editLocation = function () {
			$scope.isSavingLocation = true;
			$http.post(ajaxurl, { 
				'action': 'edit_location',
				'location': angular.toJson($scope.editor.editLocation)
			}).success(function (reply) {
				$scope.isSavingLocation = false;
				var reply = angular.fromJson(reply);
				if (reply.success) {
					updateLocation(reply.data);
					jQuery('#wpme-modal-location').modal('hide');
					gmap.goTo($scope.locations[reply.data.id]);
				}
				else {
					alert(reply.message);
				}
			}).error(function (reply, status, headers) {
				$log.error({ reply: reply });
				alert("Error.");
			});
		};

		// Actually modify the location
		$scope.deleteLocation = function () {
			$scope.isSavingLocation = true;
			$http.post(ajaxurl, { 
				'action': 'delete_location',
				'id': $scope.editor.selectedLocation.id
			}).success(function (reply) {
				$scope.isSavingLocation = false;
				var reply = angular.fromJson(reply);
				if (reply.success) {
					gmap.remove($scope.locations[$scope.editor.selectedLocation.id]);
					delete $scope.locations[$scope.editor.selectedLocation.id];
					$scope.locationsCount--;
					$scope.editor.selectedLocation = null;
					jQuery('#wpme-modal-location').modal('hide');
				}
				else {
					alert(reply.message);
				}
			}).error(function (reply, status, headers) {
				$scope.isSavingLocation = false;
				$log.error({ reply: reply });
				alert("Error.");
			});
		};

		/**************************************************************************************************
			KEYBOARD AND MOUSE BINDINGS
		**************************************************************************************************/

		jQuery(document).keyup(function (e) {
			var hasModals = jQuery('.modal:visible').length > 0;
			if (!hasModals && e.keyCode == 69) { // e
				if ($scope.editor.selectedLocation) {
					$scope.onEditLocationClick();
					$scope.$apply();
				}
			}
			else if (hasModals && e.keyCode == 27) { // escape
				jQuery('.modal').modal('hide');
			}
			else if (!hasModals && e.keyCode == 65) { // a
				if (!$scope.editor.selectedLocation) {
					$scope.onAddLocationClick();
					$scope.$apply();
				}
			}
		});

		jQuery('#wpme-import-export .nav-tabs a').click(function (e) {
			e.preventDefault();
			jQuery(this).tab('show');
		});

		// document.oncontextmenu = function() {
		// 	return false;
		// };

		/**************************************************************************************************
			DRAG
		**************************************************************************************************/

		$scope.startDraggable = function () {
			copyEditLocation();
			$scope.isDragging = true;
			gmap.setDraggable($scope.editor.selectedLocation, $scope.displayMode, true, function (coordinates, latlng) {
				$scope.editor.editLocation.coordinates = roundCoordinates(coordinates);
				$scope.editor.editLocation.latlng = latlng;
				$scope.$apply();
			});
		}

		$scope.saveDraggable = function () {
			gmap.setDraggable($scope.editor.selectedLocation, $scope.displayMode);
			$scope.isSavingLocation = true;
			$http.post(ajaxurl, { 
				'action': 'edit_location',
				'location': angular.toJson($scope.editor.editLocation)
			}).success(function (reply) {
				$scope.isSavingLocation = false;
				$scope.isDragging = false;
				var reply = angular.fromJson(reply);
				if (reply.success) {
					var map = getMap($scope.editor.editLocation.mapId);
					console.debug(map);
					updateLocation(reply.data, map);
				}
				else {
					alert(reply.message);
				}
			}).error(function (reply, status, headers) {
				$scope.isSavingLocation = false;
				$scope.isDragging = false;
				$log.error({ reply: reply });
				alert("Error.");
			});

		}

		/**************************************************************************************************
			VIEW MODE / SEARCH
		**************************************************************************************************/	

		$scope.setDisplayMode = function (mode) {
			if (mode !== 'status' && mode !== 'type' && mode !== 'period') {
				alert("Status " + mode + " not recognized.");
			}
			$scope.displayMode = mode;
			for (var i in $scope.locations) {
				gmap.setLocationIcon(	$scope.locations[i], mode );
			}
		};

		/**************************************************************************************************
			IMPORT / EXPORT
		**************************************************************************************************/

		$scope.onImportExportClick = function () {
			if (!$scope.gmap.import && !$scope.gmap.import) {
				jQuery('#wpme-modal-pro-only').modal('show');
				return;
			}
			$scope.ie.file = null;
			$scope.ie.status = 'DRAFT';
			$scope.ie.type = 'UNSPECIFIED';
			$scope.ie.locations = [];
			$scope.ie.currentIndex = null;
			$scope.ie.mapId = $scope.mostRecentMapId;
			$scope.ie.isImporting = true;
			$scope.ie.isExporting = false;
			$scope.ie.isWorking = false;
			jQuery('#wpme-import-export').modal('show');
		};

		function parseFileAsKML(content) {
			var locs = [];
			try {
				var xmlDoc = jQuery.parseXML(content);
				var xml = jQuery(xmlDoc).find('Placemark');
				var c = 0;
				while (++c < xml.length) {
					var coords = jQuery(xml[c]).find('Point coordinates').text();
					if (!coords)
						continue;
					coords = coords.split(',');
					if (coords.length < 2)
						continue;
					var fileloc = {
						name: jQuery(xml[c]).find('name').text(),
						coordinates: roundCoordinates(coords[1] + "," + coords[0]),
					};
					if (fileloc.name && fileloc.coordinates) {
						locs.push(fileloc);
					}
				}
				return locs;
			}
			catch(e) {
				$log.warn("Cannot parse file as XML");
				return null;
			}
		}

		function parseFileAsHCrap(content) {
			var locs = [];
			try {
				var json = jQuery.parseJSON(content);
				var c = 0;
				while (++c < json.length) {
					if (!json[c].lat || !json[c].lng)
						return;
					var type = "UNSPECIFIED";
					if (json[c].kind == 1 || json[c].kind == 12 || json[c].kind == 28) {
						type = "HOUSE";
					}
					else if (json[c].kind == 2 || json[c].kind == 17) {
						type = "HOTEL";
					}
					else if (json[c].kind == 3 || json[c].kind == 11 || json[c].kind == 24) {
						type = "INDUSTRIAL";
					}
					else if (json[c].kind == 4) {
						type = "HOSPITAL";
					}
					else if (json[c].kind == 5 || json[c].kind == 14 || json[c].kind == 20 || json[c].kind == 21 || json[c].kind == 31 || json[c].kind == 32) {
						type = "ENTERTAINMENT";
					}
					else if (json[c].kind == 6) {
						type = "SCHOOL";
					}
					else if (json[c].kind == 7) {
						type = "RELIGION";
					}
					else if (json[c].kind == 13 || json[c].kind == 22) {
						type = "MILITARY";
					}
					else if (json[c].kind == 23) {
						type = "LANDSCAPE";
					}
					else if (json[c].kind == 25 || json[c].kind == 26) {
						type = "OFFICE";
					}
					else if (json[c].kind == 27) {
						type = "RUIN";
					}
					var fileloc = {
						name: json[c].name,
						description: json[c].wiki,
						type: type,
						coordinates: roundCoordinates(json[c].lat + "," + json[c].lng)
					};
					if (fileloc.name && fileloc.coordinates) {
						locs.push(fileloc);
					}
				}
				return locs;
			}
			catch(e) {
				$log.warn("Cannot parse file as HCrap JSON");
				return null;
			}
		}

		$scope.onFileChanged = function (element) {
			var file = element.files[0];
			var reader = new FileReader();
			reader.onloadend = function(f) {
				var attempt = parseFileAsKML(reader.result);
				if (!attempt)
					attempt = parseFileAsHCrap(reader.result);
				if (attempt) {
					$scope.ie.locations = attempt;
					$scope.ie.isWorking = false;
					$scope.$apply();
					return;
				}
				alert("This file is not recognized.");
			};
			$scope.ie.isWorking = true;
			reader.readAsText(file);
		};

		$scope.onImportClick = function () { 
			if ($scope.ie.currentIndex === null) {
				$scope.ie.currentIndex = 0;
				$scope.ie.isWorking = true;
			}
			else if ($scope.ie.currentIndex >= $scope.ie.locations.length - 1) {
				$scope.ie.isWorking = false;
				$scope.ie.currentIndex = null;
				$scope.ie.locations = [];
				$scope.ie.file = null;
				return;
			}
			else {
				$scope.ie.currentIndex++;
			}
			$scope.editor.editLocation = {
				name: $scope.ie.locations[$scope.ie.currentIndex].name,
				description: $scope.ie.locations[$scope.ie.currentIndex].description || "",
				coordinates: $scope.ie.locations[$scope.ie.currentIndex].coordinates,
				status: $scope.ie.status,
				type: $scope.ie.locations[$scope.ie.currentIndex].type || $scope.ie.type,
				period: "ANYTIME",
				difficulty: null,
				rating: null,
				mapId: $scope.mostRecentMapId
			};
			var p = $scope.addLocation().then(function (l) {
				$scope.onImportClick();
			}, function (reply) {
				$scope.onImportClick();
			});;
		};

		/**************************************************************************************************
			GENERAL FUNCTIONS
		**************************************************************************************************/

		var roundCoordinates = function (coordinates) {
			if (!coordinates)
				return null;
			var gps = coordinates.split(',');
			if (gps.length < 2)
				return null;
			return parseFloat(gps[0]).toFixed(4) + "," + parseFloat(gps[1]).toFixed(4);
		}

		function copyEditLocation() {
			$scope.editor.editLocation = {
				id: $scope.editor.selectedLocation.id,
				description: $scope.editor.selectedLocation.description,
				name: $scope.editor.selectedLocation.name,
				coordinates: $scope.editor.selectedLocation.coordinates,
				status: $scope.editor.selectedLocation.status,
				type: $scope.editor.selectedLocation.type,
				period: $scope.editor.selectedLocation.period,
				difficulty: $scope.editor.selectedLocation.difficulty,
				rating: $scope.editor.selectedLocation.rating,
				mapId: $scope.editor.selectedLocation.mapId
			};
		}

		// Update location from a json location from the server
		var updateLocation = function(location, map) {
			if (!location.coordinates) {
				$log.warn("Location has not coordinates", location);
				return;
			}
			if (!map) {
				map = getMap(location.mapId);
				if (!map) {
					$log.warn("updateLocation requires a map or mapId", location, map);
					return;
				}
			}
			var isNew = !$scope.locations[location.id];
			var gps = location.coordinates.split(',');
			if (location.coordinates && gps.length === 2) {
				if (isNew) {
					$scope.locations[location.id] = {
						selected: false
					};
				}
				angular.extend($scope.locations[location.id], {
					id: location.id, 
					mapId: map.id, 
					mapName: map.name,
					description: location.description,
					name: location.name, 
					coordinates: roundCoordinates(location.coordinates),
					type: location.type, 
					period: location.period, 
					status: location.status,
					rating: location.rating, 
					difficulty: location.difficulty,
					latlng:  new google.maps.LatLng(gps[0].trim(), gps[1].trim(), true)
				});
				if (isNew) {
					$scope.locationsCount++;
					gmap.add($scope.locations[location.id], $scope.displayMode, markerOnMouseOver, markerOnMouseOut, markerOnClick);
				}
				else {
					gmap.update($scope.locations[location.id], $scope.displayMode);
				}
			}
			else {
				$log.warn("Location has not coordinates", location);
			}
		}

		/**************************************************************************************************
			LISTENERS
		**************************************************************************************************/

		var mapOnClick = function (lat, lng) {
			if ($scope.editor.selectedLocation) {
				if ($scope.isDragging) {
					gmap.update($scope.editor.selectedLocation); // Need to reset the location
					$scope.isDragging = false;
				}
				$scope.editor.selectedLocation.selected = false;
				gmap.setLocationIcon($scope.editor.selectedLocation, $scope.displayMode);
				$scope.editor.selectedLocation = null;
				$scope.$apply();
			}
			else {
				gmap.goTo(lat, lng);
			}
		}

		var markerOnMouseOver = function (location) {
			$scope.editor.hoveredLocation = location;
			if ($scope.editor.selectedLocation) {
				$scope.editor.distanceFromSelected = Math.round(getDistanceFromLatLonInKm(
					$scope.editor.selectedLocation.latlng.lat(), $scope.editor.selectedLocation.latlng.lng(),
					$scope.editor.hoveredLocation.latlng.lat(), $scope.editor.hoveredLocation.latlng.lng())) + " km";
			}
			$scope.$apply();
		}

		var markerOnMouseOut = function (location) {
			$scope.editor.hoveredLocation = null;
			$scope.editor.distanceFromSelected = null;
			$scope.$apply();
		}

		var markerOnClick = function (location) {
			mapOnClick();
			$scope.editor.selectedLocation = location;
			$scope.editor.selectedLocation.selected = true;
			gmap.setLocationIcon($scope.editor.selectedLocation, $scope.displayMode);
			$scope.editor.distanceFromSelected = null;
			$scope.$apply();
		}

		var activeCurrentPosition = function (fn) {
			navigator.geolocation.getCurrentPosition(function (pos) {
				var crd = pos.coords;
				fn(crd.latitude, crd.longitude);
				//console.log('Your current position is: ', crd.latitude, crd.longitude);
			}, function (err) {
				console.warn('ERROR(' + err.code + '): ' + err.message);
			}, {
				enableHighAccuracy: true,
				timeout: 500,
				maximumAge: 0
			});
		}

		function currentPositionTick() {

			if ($scope.editor.isAutoTracking) {
				activeCurrentPosition(function (lat, lng) {
					if (!$scope.editor.selectedLocation)
						gmap.setCurrentUserPost(lat, lng);
				});
			}
		}

		$scope.toggleAutoTracking = function () {
			$scope.editor.isAutoTracking = !$scope.editor.isAutoTracking;
			if ($scope.editor.isAutoTracking) {
				$scope.trackTickPromise = $interval(currentPositionTick, 2000, 0);
			}
			else if ($scope.trackTickPromise) {
				gmap.setCurrentUserPost(null);
				$interval.cancel($scope.trackTickPromise);
				$scope.trackTickPromise = undefined;
			}
			
		};

		$scope.onShowPhotosClick = function () {
			gmap.resetImages();
			var gps = roundCoordinates(gmap.getCenter());
			gps = gps.split(',');
			var year = (new Date()).getFullYear() - 8;
			$scope.isLoadingMap = true;
			$http.jsonp('https://api.flickr.com/services/rest/?method=flickr.photos.search&media=photos&extras=date_taken,path_alias,url_o,url_q,geo,owner_name&per_page=50&format=json&jsoncallback=JSON_CALLBACK', {
				params: {
					lat: gps[0],
					lon: gps[1],
					radius: 32,
					min_taken_date: year + '0101',
					api_key: gmap.flickr_apikey
				}
			}).success(function (reply, status) {
				var data = angular.fromJson(reply);
				for (var c in data.photos.photo) {
					var current = data.photos.photo[c];
					var url = 'http://flickr.com/photo.gne?id=' + current.id;
					gmap.addImage(parseInt(current.id), current.url_q, current.title, url, current.latitude, current.longitude );
				}
				$scope.isLoadingMap = false;
			}).error(function (reply, status, headers) {
				$log.error("Could not retrieve the photos from Flickr.");
				$scope.isLoadingMap = false;
			});
		}

		/**************************************************************************************************
			INIT
		**************************************************************************************************/

		gmap.onInit('wpme-map', function (mapOnClick) {
			$scope.gmapLoaded = true;
			$scope.$apply();
			loadMaps();
		}, mapOnClick);

	}

})();
