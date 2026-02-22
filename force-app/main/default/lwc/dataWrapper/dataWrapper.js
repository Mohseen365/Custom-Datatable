import { LightningElement, wire, track } from 'lwc';
import getDynamicData from '@salesforce/apex/DynamicDataTableController.getDynamicData';
import insertRecord from '@salesforce/apex/DynamicDataTableController.insertRecord';
import deleteRecordById from '@salesforce/apex/DynamicDataTableController.deleteRecordById';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import bulkUpdate from '@salesforce/apex/DynamicDataTableController.bulkUpdate';
import getAllObjects from '@salesforce/apex/DynamicDataTableController.getAllObjects';

export default class DataWrapper extends LightningElement {
    @track data;
    @track columns;
    @track error;

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
            this.error = result.error;
            this.data = undefined;
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

    handleFieldChange(event) {
        this.fieldInput = event.target.value;
    }

    handleWhereChange(event) {
        this.whereClause = event.target.value;
    }

    handleLimitChange(event) {
        this.limitSize = parseInt(event.target.value, 10);
    }

    // Load Button
    loadData() {
        if (!this.objectName || !this.fieldInput) {
            this.showToast('Error', 'Object and Fields are required', 'error');
            return;
        }

        this.request = {
            objectName: this.objectName.trim(),
            fields: this.fieldInput.split(',').map(f => f.trim()),
            whereClause: this.whereClause,
            limitSize: this.limitSize
        };
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