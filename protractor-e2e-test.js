(() => {
  'use strict';

  describe('Dictionary Talent Page', () => {
    beforeEach(() => {
      browser.get('/talent');
    });

    it('should show list of talents', () => {
      element.all(by.css('.listbody li'))
      .then(listItems => {
        expect(listItems.length).toEqual(20);
      });

      expect(element(by.css('form[name="talentvm.forms.talent"]')).isPresent()).toBeFalsy();
      expect(element(by.css('form[name="talentvm.forms.newTalent"]')).isPresent()).toBeFalsy();
    });

    it('clicking on talent list displays talent edit form', () => {
      element.all(by.css('.listbody li'))
      .first()
      .click()
      .then(() => {
        expect(element(by.css('form[name="talentvm.forms.talent"]')).isPresent()).toBeTruthy();
        expect(element(by.css('form[name="talentvm.forms.newTalent"]')).isPresent()).toBeFalsy();
      });
    });

    describe('Adding new Talent', () => {

      it('clicking on Add New Talent button displays Add New Talent form', () => {

        element(by.css('button[title="Add New Talent"]'))
        .click()
        .then(() => {
          expect(element(by.css('form[name="talentvm.forms.talent"]')).isPresent()).toBeFalsy();
          expect(element(by.css('form[name="talentvm.forms.newTalent"]')).isPresent()).toBeTruthy();
        });
      });

      it('Searching for new talent should not return any results in talent list', () => {
        const nameInput = element.all(by.model('talentvm.searchFilter')).get(0);
        nameInput.sendKeys('XXXXXNew Talent');

        element.all(by.css('.listbody li'))
        .then(listItems => {
          expect(listItems.length).toEqual(0);
        });
      });

      it('Admin can add new talent', () => {
        let nameInput;
        let genderInput;
        let roleInput;
        let submitButton;

        element(by.css('button[title="Add New Talent"]'))
        .click()
        .then(() => {
          nameInput = element.all(by.model('talentvm.searchFilter')).get(0);
          nameInput.sendKeys('XXXXXNew Talent');
          genderInput = element(by.model('talentvm.newTalent.gender'));
          roleInput = element(by.model('talentvm.newTalent.type'));
          submitButton = element(by.buttonText('Add Talent'));

          genderInput.$('[value="female"]').click();
          roleInput.$('[value="cast"]').click();

          return submitButton.click();
        })
        .then(() => element.all(by.css('.listbody li')))
        .then(listItems => {
          expect(listItems.length).toEqual(20);
          nameInput.sendKeys('XXXXX');
          expect(element(by.repeater('talent in talentvm.talents').row(0)).getText()).toEqual('XXXXXNew Talent');
          return element.all(by.css('.listbody li')).get(0);
        })
        .then(listItem => {
          expect(listItem.getText()).toEqual('XXXXXNew Talent');
        });
      });
    });

    describe('Deleting Talent', () => {
      // dependency: Admin can add new talent test
      it('Admin can remove talent', () => {
        var nameInput = element.all(by.model('talentvm.searchFilter')).get(0);
        var deleteTalentButton = $('button[title="remove selected talent"]');
        nameInput.sendKeys('');
        nameInput.sendKeys('XXXXX');

        element.all(by.css('.listbody li'))
        .first()
        .click()
        .then(() => deleteTalentButton.click())
        .then(() => element(by.buttonText('Proceed')).click())
        .then(() => element(by.buttonText('Close')).click())
        .then(() => {
          nameInput.sendKeys('XXXXXNew Talent');
          return element.all(by.css('.listbody li'));
        })
        .then(listItems => {
          expect(listItems.length).toEqual(0);
        });
      });
    });
  });
})();
