import { LightningElement, wire, track } from 'lwc';
import getDynamicData from '@salesforce/apex/DynamicDataTableController.getDynamicData';
import insertRecord from '@salesforce/apex/DynamicDataTableController.insertRecord';
import deleteRecordById from '@salesforce/apex/DynamicDataTableController.deleteRecordById';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import bulkUpdate from '@salesforce/apex/DynamicDataTableController.bulkUpdate';
import getAllObjects from '@salesforce/apex/DynamicDataTableController.getAllObjects';
import getObjectFields from '@salesforce/apex/DynamicDataTableController.getObjectFields';

export default class DataWrapper extends LightningElement {
    @track data;
    @track columns;
    @track error;
    @track fieldOptions = [];
    @track selectedFields = [];

    wiredResult;

    objectName = 'Account';
    fieldInput = 'Name, Industry, Phone';
    whereClause = '';
    limitSize = 20;

    request;

    get jsonRequest() {
        return this.request ? JSON.stringify(this.request) : null;
    }

    @track objectOptions = [];

    @wire(getAllObjects)
    wiredObjects(result) {
        console.log('WIRE RESULT:', result);

        if (result.data) {
            console.log('DATA RECEIVED:', result.data);
            this.objectOptions = result.data;
        }

        if (result.error) {
            console.error('WIRE ERROR:', result.error);
        }
    }

    @wire(getObjectFields, { objectName: '$objectName' })
    wiredFields({ data, error }) {
        if (data) {
            this.fieldOptions = data;
            this.selectedFields = []; // reset when object changes
        } else if (error) {
            console.error('Error loading fields', error);
        }
    }

    @wire(getDynamicData, { request: '$jsonRequest' })
    wiredData(result) {
        this.wiredResult = result;

        if (result.data) {
            this.columns = result.data.columns.map(col => ({
                ...col,
                sortable: true,
                editable: true 
            }));

            this.data = result.data.rows;
            this.error = undefined;

        } else if (result.error) {
            this.error = this.reduceErrors(result.error).join(', ');
            this.data = undefined;
            this.columns = undefined;
        }
    }

    
    handleBulkUpdate(event) {
        bulkUpdate({
            objectName: this.request.objectName,
            recordIds: event.detail.recordIds,
            values: event.detail.values
        })
        .then(() => this.refreshData());
    }
    handleCreate(event) {
        insertRecord({
            objectName: this.request.objectName,
            fields: event.detail
        })
        .then(() => this.refreshData());
    }
    
    handleDelete(event) {
        deleteRecordById({ recordId: event.detail })
            .then(() => this.refreshData());
    }

    handleObjectChange(event) {
        this.objectName = event.target.value;
    }

    handleFieldSelection(event) {
        this.selectedFields = event.detail.value;
    }

    handleWhereChange(event) {
        this.whereClause = event.target.value;
    }

    handleLimitChange(event) {
        this.limitSize = parseInt(event.target.value, 10);
    }

    // Load Button
    loadData() {
        if (!this.objectName || this.selectedFields.length === 0) {
            this.showToast('Error', 'Select object and at least one field', 'error');
            return;
        }

        this.request = {
            objectName: this.objectName,
            fields: this.selectedFields,
            whereClause: this.whereClause,
            limitSize: this.limitSize
        };
    }
    
    reduceErrors(errors) {
        if (!Array.isArray(errors)) {
            errors = [errors];
        }
    
        return (
            errors
                .filter(error => !!error)
                .map(error => {
                    if (Array.isArray(error.body)) {
                        return error.body.map(e => e.message);
                    } else if (error.body && typeof error.body.message === 'string') {
                        return error.body.message;
                    } else if (typeof error.message === 'string') {
                        return error.message;
                    }
                    return error.statusText;
                })
                .reduce((prev, curr) => prev.concat(curr), [])
                .filter(message => !!message)
        );
    }

    async refreshData() {
        await refreshApex(this.wiredResult);

        const child = this.template.querySelector('c-data-table');
        if (child) {
            child.refreshTable(this.data);
        }
        this.showToast('Success', 'Data refreshed Successfully', 'success');
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }
}