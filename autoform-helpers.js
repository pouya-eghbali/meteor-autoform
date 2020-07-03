import { isFunction } from './common'

/* global arrayTracker, AutoForm */

function parseOptions(options) {
  var hash = (options || {}).hash || {};
  // Find the form's schema
  var ss = AutoForm.getFormSchema();
  return { ...hash, ss }
}

/*
 * Global template helpers (exported to app)
 */

/*
 * afFieldMessage
 */
Template.registerHelper('afFieldMessage', function autoFormFieldMessage(options) {
  options = parseOptions(options, 'afFieldMessage');
  var formId = AutoForm.getFormId();

  return options.ss.namedContext(formId).keyErrorMessage(options.name);
});

/*
 * afFieldIsInvalid
 */
Template.registerHelper('afFieldIsInvalid', function autoFormFieldIsInvalid(options) {
  options = parseOptions(options, 'afFieldIsInvalid');
  var formId = AutoForm.getFormId();

  return options.ss.namedContext(formId).keyIsInvalid(options.name);
});

/*
 * afArrayFieldHasMoreThanMinimum
 */
Template.registerHelper('afArrayFieldHasMoreThanMinimum', function autoFormArrayFieldHasMoreThanMinimum(options) {
  options = parseOptions(options, 'afArrayFieldHasMoreThanMinimum');
  var form = AutoForm.getCurrentDataPlusExtrasForForm();

  // Registered form types can disable adding/removing array items
  if (form.formTypeDef.hideArrayItemButtons) {
    return false;
  }

  var range = arrayTracker.getMinMax(options.ss, options.name, options.minCount, options.maxCount);
  var visibleCount = arrayTracker.getVisibleCount(form.id, options.name);
  return (visibleCount > range.minCount);
});

/*
 * afArrayFieldHasLessThanMaximum
 */
Template.registerHelper('afArrayFieldHasLessThanMaximum', function autoFormArrayFieldHasLessThanMaximum(options) {
  options = parseOptions(options, 'afArrayFieldHasLessThanMaximum');
  var form = AutoForm.getCurrentDataPlusExtrasForForm();

  // Registered form types can disable adding/removing array items
  if (form.formTypeDef.hideArrayItemButtons) {
    return false;
  }

  var range = arrayTracker.getMinMax(options.ss, options.name, options.minCount, options.maxCount);
  var visibleCount = arrayTracker.getVisibleCount(form.id, options.name);
  return (visibleCount < range.maxCount);
});

/*
 * afFieldValueIs
 */
Template.registerHelper('afFieldValueIs', function autoFormFieldValueIs(options) {
  options = parseOptions(options, 'afFieldValueIs');

  var currentValue = AutoForm.getFieldValue(options.name, options.formId);
  return currentValue === options.value;
});

/*
 * afFieldValue
 */
Template.registerHelper('afFieldValue', function autoFormFieldValue(options) {
  options = parseOptions(options, 'afFieldValue');

  return AutoForm.getFieldValue(options.name, options.formId || AutoForm.getFormId());
});

/*
 * afArrayFieldIsFirstVisible
 */
Template.registerHelper('afArrayFieldIsFirstVisible', function autoFormArrayFieldIsFirstVisible() {
  var context = this;
  return arrayTracker.isFirstFieldlVisible(context.formId, context.arrayFieldName, context.index);
});

/*
 * afArrayFieldIsLastVisible
 */
Template.registerHelper('afArrayFieldIsLastVisible', function autoFormArrayFieldIsLastVisible() {
  var context = this;
  return arrayTracker.isLastFieldlVisible(context.formId, context.arrayFieldName, context.index);
});

/*
 * afFieldValueContains
 */
Template.registerHelper('afFieldValueContains', function autoFormFieldValueContains(options) {
  options = parseOptions(options, 'afFieldValueContains');

  var currentValue = AutoForm.getFieldValue(options.name, options.formId);
  return Array.isArray(currentValue)
    && (currentValue.includes(options.value)
      || options.values
      && options.values.split(',').filter(item => currentValue.includes(item)));
});

/*
 * afFieldLabelText
 */
Template.registerHelper('afFieldLabelText', function autoFormFieldLabelText(options) {
  options = parseOptions(options, 'afFieldLabelText');
  return AutoForm.getLabelForField(options.name);
});

/*
 * afFieldNames
 */
Template.registerHelper('afFieldNames', function autoFormFieldNames(options) {
  options = parseOptions(options, 'afFieldNames');
  var ss = options.ss, name = options.name, namePlusDot, genericName, genericNamePlusDot;
  var form = AutoForm.getCurrentDataForForm();

  if (name) {
    namePlusDot = name + '.';
    genericName = AutoForm.Utility.makeKeyGeneric(name);
    genericNamePlusDot = genericName + '.';
  }

  // Get the list of fields we want included
  var fieldList = options.fields, usedAncestorFieldList = false;
  if (fieldList) {
    fieldList = AutoForm.Utility.stringToArray(fieldList, 'AutoForm: fields attribute must be an array or a string containing a comma-delimited list of fields');
  }

  var ancestorFieldList = AutoForm.findAttribute('fields');
  if (ancestorFieldList) {
    ancestorFieldList = AutoForm.Utility.stringToArray(ancestorFieldList, 'AutoForm: fields attribute must be an array or a string containing a comma-delimited list of fields');

    // Use the ancestor field list as backup, unless there is
    // a name and that name is listed in the ancestor field list
    if (!fieldList) {
      fieldList = ancestorFieldList;
      usedAncestorFieldList = true;
    }
  }

  if (fieldList) {

    // Take only those fields in the fieldList that are descendants of the `name` field
    if (name) {
      // Replace generic name with real name. We assume that field names
      // with $ apply to all array items. Field list will now have the
      // correct array field item number instead of $.
      if (genericName !== name) {
        fieldList = fieldList.map(function (field) {
          if (field && field.indexOf(genericNamePlusDot) === 0) {
            return namePlusDot + field.slice(genericNamePlusDot.length);
          }
          return field;
        });
      }

      fieldList = fieldList.filter(function filterFieldsByName(field) {
        return field && field.indexOf(namePlusDot) === 0;
      });
    }

    // If top level fields, be sure to remove any with $ in them
    else {
      fieldList = fieldList.filter(function filterArrayFields(field) {
        return (field && field.slice(-2) !== '.$' && field.indexOf('.$.') === -1);
      });
    }

    // First we filter out any fields that are subobjects where the
    // parent object is also in the fieldList and is NOT the current
    // field name.
    // This means that if you do `fields="address,address.city"` we
    // will use an afObjectField for address and include only the
    // "city" field within that, but if you instead do `fields="address.city"`
    // we will use a single field for the city, with no afObjectField
    // template around it.
    fieldList = fieldList.filter(function (field) {
      var lastDotPos = field.lastIndexOf('.');
      if (lastDotPos === -1) {
        return true; // keep
      }

      var parentField = field.slice(0, lastDotPos);
      if (parentField.slice(-2) === '.$') {
        parentField = parentField.slice(0, -2);
      }
      return !fieldList.includes(parentField) || parentField === name || parentField === genericName
    });
  }

  if (!fieldList || (fieldList.length === 0 && usedAncestorFieldList)) {
    // Get list of field names that are descendants of this field's name.
    // If name/genericName is undefined, this will return top-level
    // schema keys.
    fieldList = ss.objectKeys(genericName);

    if (name) {
      // Tack child field name on to end of parent field name. This
      // ensures that we keep the desired array index for array items.
      fieldList = fieldList.map(function (field) {
        return name + '.' + field;
      });
    }
  }

  // If user wants to omit some fields, remove those from the array
  var omitFields = options.omitFields || AutoForm.findAttribute('omitFields');
  if (omitFields) {
    omitFields = AutoForm.Utility.stringToArray(omitFields, 'AutoForm: omitFields attribute must be an array or a string containing a comma-delimited list of fields');
    fieldList = fieldList.filter(field => !omitFields.includes(field))
    // If omitFields contains generic field names (with $) we omit those too
    fieldList = fieldList.filter(function (f) {
      return !omitFields.includes(AutoForm.Utility.makeKeyGeneric(f));
    });
  }

  // Filter out fields we never want
  fieldList = fieldList.filter(function shouldIncludeField(field) {
    var fieldDefs = AutoForm.Utility.getFieldDefinition(ss, field);

    // Don't include fields that are not in the schema
    if (!fieldDefs) {
      return false;
    }

    // Don't include fields with autoform.omit=true
    if (fieldDefs.autoform && fieldDefs.autoform.omit === true) {
      return false;
    }

    if (fieldDefs.autoform && isFunction(fieldDefs.autoform.omit) && fieldDefs.autoform.omit(field) === true) {
      return false;
    }

    // Don't include fields with denyInsert=true when it's an insert form
    if (fieldDefs.denyInsert && form.type === 'insert') {
      return false;
    }

    // Don't include fields with denyUpdate=true when it's an update form
    if (fieldDefs.denyUpdate && form.type === 'update') {
      return false;
    }

    return true;
  });

  // Ensure fields are not added more than once
  fieldList = [...new Set(fieldList)];

  // We return it as an array of objects because that
  // works better with Blaze contexts
  fieldList = fieldList.map(function (name) {
    return { name: name };
  });

  return fieldList;
});


/*
 * afSelectOptionAtts
 */
Template.registerHelper('afSelectOptionAtts', function afSelectOptionAtts() {
  if (this.value === false) this.value = 'false'
  var atts = 'value' in this ? { value: this.value } : {}
  if (this.selected) {
    atts.selected = '';
  }
  if (this.htmlAtts) {
    Object.assign(atts, this.htmlAtts);
  }
  return atts;
});

// Expects to be called with this.name available
Template.registerHelper('afOptionsFromSchema', function afOptionsFromSchema() {
  return AutoForm._getOptionsForField(this.name);
});
