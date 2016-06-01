(() => {
  'use strict';

  angular
  .module('xxx')
  .controller('AssetCtrl', AssetCtrl);

  AssetCtrl.$inject = ['WeAPI', '$state', 'AssetService', 'UIState', 'BucketService', 'PromptService', 'WeFilter', '$q'];

  function AssetCtrl(WeAPI, $state, AssetService, UIState, BucketService, PromptService, WeFilter, $q) {
    var assetvm = this;

    assetvm.addFilter             = addFilter;
    assetvm.addCatOrSecFilter     = addCatOrSecFilter;
    assetvm.addPartnerLibFilter   = addPartnerLibFilter;
    assetvm.bucketSelected        = bucketSelected;
    assetvm.changePubStatusFilter = changePubStatusFilter;
    assetvm.callApi               = callApi;
    assetvm.changePageSize        = changePageSize;
    assetvm.changeOrderBy         = changeOrderBy;
    assetvm.clearSelectedAssets   = clearSelectedAssets;
    assetvm.getPageSize           = getPageSize;
    assetvm.quickAddToBucket      = quickAddToBucket;
    assetvm.removeFilter          = removeFilter;
    assetvm.resetOwnershipForm    = resetOwnershipForm;
    assetvm.searchCatsAndSecs     = searchCatsAndSecs;
    assetvm.searchPartners        = searchPartners;
    assetvm.selectPartner         = selectPartner;
    assetvm.setDisplayPageAs      = setDisplayPageAs;
    assetvm.toggleSelectAll       = toggleSelectAll;
    assetvm.toggleSelectOne       = toggleSelectOne;
    assetvm.toggleLeftSidebar     = toggleLeftSidebar;

    assetvm.booleanFilterMap      = WeFilter.booleanFilterMap;
    assetvm.perPageOptions        = UIState.getPageSizeOptions();
    assetvm.orderByOptions        = UIState.getAssetOrderByOptions();
    assetvm.statusFilterOptions   = WeFilter.getStatusFilterOptions();

    activate();

    ////////////////

    function activate() {
      assetvm.currentPage        = UIState.getCurrentPage();
      assetvm.searchQuery        = UIState.getQuery();
      assetvm.perPage            = UIState.getCurrentPageSize();
      assetvm.orderBy            = UIState.getCurrentOrderBy().value;
      assetvm.pubStatusFilter    = WeFilter.getCurPubStatusFilter().value;
      assetvm.displayPageAs      = UIState.getPageDisplayFormat();
      assetvm.isLeftSidebarOpen  = UIState.isLeftSidebarOpen();

      assetvm.catOrSecSearchResults = [];
      assetvm.partnerSearchResults  = [];
      assetvm.selectedPartner = null;

      BucketService.getBucketCache()
      .then(response => {
        assetvm.bucketList = response;
        setSelectedBucketDropdown(assetvm.bucketList);
      })
      .catch(err => {
        handleError(err);
      });

      applyFilters();
    }

    function callApi() {
      checkIfNewQuery(); // sets currentPage to 1 if new query

      WeAPI.filter('clips/filter', assetvm.currentPage, assetvm.perPage, assetvm.orderBy, assetvm.appliedFilters, assetvm.searchQuery)
      .then(response => {
        assetvm.assets             = response.data.payload;
        assetvm.totalAssets        = response.data.meta.count;
        assetvm.totalPages         = Math.ceil(assetvm.totalAssets / assetvm.perPage);
        assetvm.currentState       = $state.current.name;
        assetvm.allSelected        = false;
        assetvm.selectedAssetCount = _.keys(AssetService.getSelected()).length;
        setSelectedAssetCheckbox();
        _updateUIState();
      })
      .catch(err => {
        handleError(err);
      });
    }

    function bucketSelected(bucket) {
      BucketService.setActiveBucket(bucket);
    }

    function changePageSize(pageSize) {
      UIState.setCurrentPageSize(pageSize);
      assetvm.perPage = UIState.getCurrentPageSize();
      callApi();
    }

    function changeOrderBy(orderBy) {
      UIState.setCurrentOrderBy(orderBy);
      callApi();
    }

    function clearSelectedAssets() {
      AssetService.clearSelection();
      setSelectedAssetCheckbox();
      assetvm.allSelected = false;
    }

    function checkIfNewQuery() {
      if (assetvm.searchQuery !== UIState.getQuery()) {
        _resetCurrentPageNum();
      }
    }

    // ---------------------------------------------------------------------------------------------------
    // FILTERING
    // ---------------------------------------------------------------------------------------------------

    function addFilter(filter) {
      var displayString = WeFilter.formatFilterDisplayString(filter);
      WeFilter.addFilter(filter, displayString);
      _resetCurrentPageNum();
      applyFilters();
    }

    function changePubStatusFilter(pubStatus) {
      WeFilter.changePubStatusFilter(pubStatus);
      assetvm.pubStatusFilter = WeFilter.getCurPubStatusFilter().value;
      _resetCurrentPageNum();
      applyFilters();
    }

    function addCatOrSecFilter(catOrSec) {
      _resetCurrentPageNum();
      _resetLibCatFilters();

      // catalogs don't have catalogRef property
      if (!catOrSec.catalogRef) {

        WeFilter.addFilter({ catalog: [catOrSec._id] }, `Catalog > ${catOrSec.name}`);
        applyFilters();

      } else {

        // sections need to traverse up to catalog - > CatalogName> Section > SubSection
        WeAPI.getOne('catalogs/tree', catOrSec._id)
        .then(response => {
          var sectionString = 'Catalog: ';
          _.each(response.data, section => {
            sectionString += `${section.name} > `;
          });
          sectionString = sectionString.slice(0, -2);
          WeFilter.addFilter({ section: [catOrSec._id] }, sectionString);
          applyFilters();
        })
        .catch(err => {
          handleError(err);
        });

      }
      assetvm.catOrSecSearchQuery = '';
      assetvm.catOrSecSearchResults = [];
    }

    function addPartnerLibFilter(partnerOrLibrary) {
      var libraryIdsArray = [];
      var partnerName;
      _resetCurrentPageNum();

      if (!partnerOrLibrary) { return; } // deal with digest loop triggered by $mouseover

      _resetLibCatFilters();

      // partner has libraries property
      if (partnerOrLibrary.libraries) {

        if (_.isEmpty(partnerOrLibrary.libraries)) {
          return PromptService.create('Partner has no associated libraries!');
        }
        assetvm.partnerSelected = partnerOrLibrary;
        libraryIdsArray = _.map(partnerOrLibrary.libraries, '_id');
        WeFilter.setPartnerName(partnerOrLibrary.name);
        WeFilter.addFilter({ library: libraryIdsArray }, `Partner : '${partnerOrLibrary.name}`);

      } else {
        // add partner's library filter
        partnerName = WeFilter.getPartnerName();
        libraryIdsArray = [partnerOrLibrary._id];
        assetvm.partnerSearchResults = [];
        assetvm.forms.ownership.isOpen = false;
        WeFilter.addFilter({ library: libraryIdsArray }, `${partnerName} > ${partnerOrLibrary.name}`);
      }

      assetvm.selectedLibrary = '';
      applyFilters();
    }

    function applyFilters() {
      assetvm.appliedFilters = WeFilter.getAppliedFilters();
      assetvm.appliedFiltersDisplayList = WeFilter.getFilterDisplayList();
      assetvm.numAppliedFilters = assetvm.appliedFiltersDisplayList.length;
      _.each(assetvm.forms, form => {
        form.isOpen = false;
      });
      callApi();
    }

    function removeFilter(filter) {

      if (filter.name.match(/^Publish Status > Status/)) {
        return PromptService.create('Please use status dropdown selector for publish status filter changes!');
      }

      WeFilter.removeFilter(filter.filter, filter.name);
      _resetCurrentPageNum();
      applyFilters();
    }

    function _resetLibCatFilters() {
      // when adding new cat, sec or lib filter we remove previous lib, cat, sec filters, keep other filters
      WeFilter.resetLibCatFilters();
    }

    function resetOwnershipForm() {
      assetvm.partnerSelected = null;
      assetvm.partnerSearchQuery = '';
      assetvm.partnerLibraryList = [];
      assetvm.partnerSearchResults = [];
    }

    function searchCatsAndSecs() {
      var catalogSearch;
      var sectionSearch;

      if (assetvm.catOrSecSearchQuery === '') {
        assetvm.catOrSecSearchResults = [];
        return;
      }

      catalogSearch = WeAPI.searchEndpoint('catalogs/search', assetvm.catOrSecSearchQuery, null);
      sectionSearch = WeAPI.searchEndpoint('sections/search', assetvm.catOrSecSearchQuery, null);

      $q.all([catalogSearch, sectionSearch])
      .then(responses => {
        assetvm.catOrSecSearchResults = _.reduce(responses, (memo, response) => memo.concat(response.data.payload), []);
      })
      .catch(err => {
        handleError(err);
      });
    }

    function searchPartners() {
      if (assetvm.partnerSearchQuery === '') {
        assetvm.partnerSearchResults = [];
        return;
      }

      WeAPI.searchEndpoint('contentpartners/search', assetvm.partnerSearchQuery, null)
      .then(response => {
        assetvm.partnerSearchResults = response.data.payload;
      })
      .catch(err => {
        handleError(err);
      });
    }

    function selectPartner(partner) {
      assetvm.partnerSearchQuery = '';
      addPartnerLibFilter(partner);
      assetvm.partnerLibraryList = partner.libraries;
    }

    // ------------------------------------------------------------------------------------------------------
    // END FILTERING
    // ------------------------------------------------------------------------------------------------------

    function getPageSize() {
      return UIState.getCurrentPageSize();
    }

    function setDisplayPageAs(format) {
      UIState.setPageDisplayFormat(format);
      assetvm.displayPageAs = format;
    }

    function setSelectedAssetCheckbox() {
      // compares listed assets on page with selected assets in AssetService
      _.each(assetvm.assets, asset => {
        asset.selected = !!(asset._id in AssetService.getSelected());
      });

      assetvm.selectedAssetCount = _.keys(AssetService.getSelected()).length;
    }

    function setSelectedBucketDropdown(bucketList) {
      var activeBucket = BucketService.getActiveBucket();
      var selectedBucketIndex = _.findIndex(bucketList, bucket => bucket._id === activeBucket._id);

      assetvm.dropdownSelectedBucket = assetvm.bucketList[selectedBucketIndex];
    }

    function toggleSelectOne(asset) {
      if (asset.selected) {
        AssetService.addToSelection(asset);
      } else {
        AssetService.removeFromSelection(asset);
      }

      setSelectedAssetCheckbox();
    }

    function toggleSelectAll() {
      _.each(assetvm.assets, asset => {
        asset.selected = !assetvm.allSelected;
        if (asset.selected) {
          AssetService.addToSelection(asset);
        } else {
          AssetService.removeFromSelection(asset);
        }
      });

      setSelectedAssetCheckbox();
      assetvm.allSelected = !assetvm.allSelected;
    }

    function toggleLeftSidebar() {
      UIState.toggleLeftSidebar();
      assetvm.isLeftSidebarOpen = UIState.isLeftSidebarOpen();
    }

    function quickAddToBucket() {
      var selectedBucket;
      var priorAssets;
      var updatedAssetList;

      if (!_.isEmpty(AssetService.getSelected())) {

        if (_.isEmpty(BucketService.getActiveBucket())) {
          PromptService.create('Please select bucket');
          return;
        }
        selectedBucket = BucketService.getActiveBucket();
        // check if bucket assets are fully populated objects or just array of id's
        priorAssets = selectedBucket.assets.length && selectedBucket.assets[0].hasOwnProperty('_id') ?
          _.map(selectedBucket.assets, '_id') : selectedBucket.assets;

        updatedAssetList = _.union(priorAssets, _.map(AssetService.getSelected(), '_id'));

        WeAPI.editOne('buckets', selectedBucket._id, { assets: updatedAssetList })
        .then(response => {
          BucketService.setActiveBucket(response.data);
          BucketService.resetBucketCache();
          PromptService.createFlash('Assets added to bucket');
        })
        .catch(err => {
          handleError(err);
        });
      } else {
        PromptService.create('Select assets to add to bucket first!');
      }
    }

    // //////////////////////////////////


    function _resetCurrentPageNum() {
      UIState.setCurrentPage(1);
      assetvm.currentPage = UIState.getCurrentPage();
    }

    function _updateUIState() {
      UIState.setQuery(assetvm.searchQuery);
      UIState.setCurrentPage(assetvm.currentPage);
      UIState.setPageDisplayFormat(assetvm.displayPageAs);
    }

    function handleError(err) {
      console.log(err);
      PromptService.create(err.data.error || err.data.msg || err.data);
    }
  }
})();
