(() => {
  'use strict';

  angular
  .module('xxx')
  .controller('TalentCtrl', TalentCtrl);

  TalentCtrl.$inject = ['APIService', 'PromptService', 'TalentService'];

  function TalentCtrl(APIService, PromptService, TalentService) {
    var talentvm = this;

    talentvm.addAltName       = addAltName;
    talentvm.addNewTalent     = addNewTalent;
    talentvm.removeTalent     = removeTalent;
    talentvm.removeAltName    = removeAltName;
    talentvm.saveEditedTalent = saveEditedTalent;
    talentvm.selectTalent     = selectTalent;
    talentvm.displayAddNewTalentForm = displayAddNewTalentForm;

    activate();

    // //////////////

    function activate() {
      APIService.getAll('talents')
      .then(response => {
        talentvm.talents = response.data;
        talentvm.newTalent = { altNames: [] };
        talentvm.selectedTalent = {};
        talentvm.displayingAddNewTalentForm = false;
        talentvm.displayingEditTalentForm = false;
        talentvm.searchFilter = '';
      })
      .catch(err => {
        handleError(err);
      });
    }

    function addNewTalent() {
      var talent;

      if (!talentvm.searchFilter || !talentvm.newTalent.gender || !talentvm.newTalent.type) {
        return PromptService.create('Name, gender and general role required');
      }

      if (_isNameAlreadyExists({ name: talentvm.searchFilter, _id: null })) {
        return PromptService.create('A person with this name already exists!');
      }

      talent = {
        name    : talentvm.searchFilter,
        gender  : talentvm.newTalent.gender,
        altNames: talentvm.newTalent.altNames || [],
        type    : talentvm.newTalent.type,
      };

      APIService.createOne('talents', talent)
      .then(() => {
        PromptService.createFlash('Talent successfully added');
        TalentService.resetTalentCache();
        activate();
      })
      .catch(err => {
        handleError(err);
      });
    }

    function addAltName(type, newAltName) {
      if (type === 'newTalent') {
        talentvm.newTalent.altNames.push(newAltName);
        talentvm.newTalent.newAltName = '';
        return;
      }

      talentvm.selectedTalent.altNames.push(newAltName);
      talentvm.selectedTalent.newAltName = '';
    }

    function displayAddNewTalentForm() {
      // using talentvm.searchFilter for two way binding of name field
      talentvm.displayingEditTalentForm = false;
      talentvm.displayingAddNewTalentForm = true;
      talentvm.selectedTalent = {};
    }

    function removeAltName(type, index) {
      if (type === 'newTalent') {
        talentvm.newTalent.altNames.splice(index, 1);
        return;
      }

      talentvm.selectedTalent.altNames.splice(index, 1);
    }

    function removeTalent(talent) {
      var message = `This will remove ${talent.name} from the database. It will also remove any references to this talent in any clips!`;
      PromptService.create(message, ['Proceed', 'Cancel'], function(option) {
        if (option === 'Proceed') {
          APIService.deleteOne('talents', talent._id)
          .then(() => {
            PromptService.create('Talent successfully deleted');
            TalentService.resetTalentCache();
            activate();
          })
          .catch(err => {
            handleError(err);
          });
        } else {
          this.destroy();
        }
      });
    }

    function saveEditedTalent() {
      var talent;

      if (talentvm.forms.talent.talentName.$dirty && _isNameAlreadyExists(talentvm.selectedTalent)) {
        return PromptService.create('A person with this name already exists!');
      }

      talent = {
        name    : talentvm.selectedTalent.name,
        gender  : talentvm.selectedTalent.gender,
        altNames: talentvm.selectedTalent.altNames || [],
        type    : talentvm.selectedTalent.type,
      };

      APIService.editOne('talents', talentvm.selectedTalent._id, talent)
      .then(() => {
        PromptService.createFlash('Talent successfully edited!');
        TalentService.resetTalentCache();
        activate();
      })
      .catch(err => {
        handleError(err);
      });
    }

    function selectTalent(talent) {
      talentvm.selectedTalent = angular.copy(talent);
      talentvm.displayingAddNewTalentForm = false;
      talentvm.displayingEditTalentForm = true;
    }

    ////////////////

    function handleError(err) {
      PromptService.create('Error: ', err.statusText);
      console.log(err);
    }

    function _isNameAlreadyExists(selectedTalent) {
      // match talent name and altNames

      return _.some(talentvm.talents, talent => {
        // skip checking self
        if (talent._id === selectedTalent._id) {
          return false;
        }

        return talent.name.toLowerCase() === (selectedTalent.name.toLowerCase() ||
          _.some(talent.altNames, altName => altName.toLowerCase() === selectedTalent.name.toLowerCase()));
      });
    }
  }
})();
