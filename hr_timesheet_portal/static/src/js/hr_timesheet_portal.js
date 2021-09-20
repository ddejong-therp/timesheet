/* Copyright 2021 Hunki Enterprises BV
 * License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl). */

odoo.define("hr_timesheet_portal", function(require) {
    "use strict";

    var sAnimation = require("website.content.snippets.animation");
    var rpc = require("web.rpc");
    var core = require("web.core");
    var session = require('web.session');
    
    var _t = core._t;

    sAnimation.registry.hr_timesheet_portal = sAnimation.Widget.extend({
        selector: "div.hr_timesheet_portal",
        events: {
            "click h5": "_onclick_add",
            "click tr[data-line-id]:not(.edit)": "_onclick_edit",
            "click .fa-remove": "_onclick_delete",
            "click button.submit": "_onclick_submit",
            "submit form#hr_timesheet_portal": "_onclick_submit",
            "click button.cancel": "_reload_timesheet",
        },

        start: function(editable_mode) {
            if (editable_mode) {
                this.stop();
                return;
            }
        },

        _onclick_delete: function(e) {
            e.stopPropagation();

            var line = jQuery(e.target).parents("tr")
            var line_user_id = line.data("user-id")

            if (line_user_id == session.user_id) {
                var line_name = line.find('td[data-field-name="name"]').text()

                if (confirm(_t(`Are you sure you want to remove line "${line_name}"?`))) {

                    rpc.query({
                        model: "account.analytic.line",
                        method: "unlink",
                        args: [
                            [
                                jQuery(e.currentTarget)
                                    .parents("tr")
                                    .data("line-id"),
                            ],
                        ],
                    })
                        .then(this.proxy("_reload_timesheet"))
                        .catch(this.proxy("_display_failure"));
                }
            }
        },

        _onclick_add: function() {
            var self = this;
            return rpc
                .query({
                    model: "account.analytic.line",
                    method: "create",
                    args: [
                        {
                            user_id: this.getSession().user_id,
                            account_id: this.$el.data("account-id"),
                            project_id: this.$el.data("project-id"),
                            task_id: this.$el.data("task-id"),
                            unit_amount: 0,
                            name: "/",
                        },
                    ],
                })
                .then(function(line_id) {
                    return self._reload_timesheet().then(function() {
                        setTimeout(self._edit_line.bind(self, line_id), 0);
                    });
                })
                .catch(this.proxy("_display_failure"));
        },

        _onclick_edit: function(e) {
            var line = jQuery(e.target).parents("tr")

            if (line.data('user-id') == session.user_id)
                return this._edit_line(line.data("line-id"));
        },

        _onclick_submit: function(e) {
            e.preventDefault();

            var $tr = jQuery(e.target).parents("tr")
            var $form = $tr.find("form")

            var valid = true
            $tr.find("input[type='time-duration']").each((i, el) => {

                if (!this._verify_time_duration(el.value)) {
                    alert(_t('Time duration has invalid format'))
                    valid = false
                }
            })
            if (!valid) return

            var data = _.object(_.map($form.serializeArray(), function(a) {
                    return [a.name, a.value];
                })
            );
            return rpc
                .query({
                    model: "account.analytic.line",
                    method: "write",
                    args: [$tr.data("line-id"), data],
                })
                .then(this.proxy("_reload_timesheet"))
                .catch(this.proxy("_display_failure"));
        },

        _reload_timesheet: function() {
            var self = this;
            this.$el.children("div.alert").remove();
            return $.ajax({
                dataType: "html",
            }).then(function(data) {
                var timesheets = _.filter(jQuery.parseHTML(data), function(element) {
                        return (
                            jQuery(element).find("div.hr_timesheet_portal").length > 0
                        );
                    }),
                    $tbody = jQuery(timesheets).find("tbody");
                return self.$("tbody").replaceWith($tbody);
            });
        },

        _display_failure: function(error) {
            this.$el.prepend(
                jQuery('<div class="alert alert-danger">').text(`[${error.message.message}]: ${error.message.data.message}`)
            );
        },

        _edit_line: function(line_id) {
            var $line = this.$(_.str.sprintf("tr[data-line-id=%s]", line_id)),
                $edit_line = $line.clone();
            this.$("tbody tr.edit").remove();
            this.$("tbody tr").show();
            $line.before($edit_line);
            $edit_line.children("[data-field-name]").each(function() {
                var $this = jQuery(this),
                    $input = jQuery("<input>", {
                        class: "form-control",
                        type: $this.data("field-type") || "text",
                        value: $this.data("field-value") || $this.text(),
                        form: "hr_timesheet_portal_form",
                        name: $this.data("field-name"),
                    });
                $this.empty().append($input);
            });
            $edit_line.addClass("edit");
            var $form = jQuery("<form>", {
                    id: "hr_timesheet_portal_form",
                }),
                $submit = jQuery('<button class="btn btn-primary submit">'),
                $cancel = jQuery('<button class="btn cancel" type="reset">');
            $edit_line.children("td:last-child").prepend($form);
            $submit.text(_t("Submit"));
            $cancel.text(_t("Cancel"));
            $form.append($submit, $cancel);
            $edit_line.find("input:first").focus();
            $line.hide();
        },

        _verify_time_duration: (string) => {
            var i = string.search(':')

            if (i == -1)    return false

            var j = string.substring(i+1).search(':')
            if (j != -1)    return false

            return true
        }
    });
    return {hr_timesheet_portal: sAnimation.registry.hr_timesheet_portal};
});
