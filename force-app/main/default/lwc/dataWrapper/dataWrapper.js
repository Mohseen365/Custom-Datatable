import { LightningElement, wire, track } from 'lwc';
import getDynamicData from '@salesforce/apex/DynamicDataTableController.getDynamicData';
import insertRecord from '@salesforce/apex/DynamicDataTableController.insertRecord';
import deleteRecordById from '@salesforce/apex/DynamicDataTableController.deleteRecordById';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import bulkUpdate from '@salesforce/apex/DynamicDataTableController.bulkUpdate';

export default class DataWrapper extends LightningElement {
    @track data;
    @track columns;
    @track error;

    wiredResult;

    request = {
        objectName: 'Account',
        fields: ['Id', 'Name', 'Industry', 'Phone'],
        whereClause: '',
        limitSize: 20
    };

    // Convert to JSON string for Apex
    get jsonRequest() {
        return JSON.stringify(this.request);
    }

    @wire(getDynamicData, { request: '$jsonRequest' })
    wiredData(result) {
        this.wiredResult = result;

        if (result.data) {
            this.columns = result.data.columns.map(col => ({
                ...col,
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

    async refreshData() {
        await refreshApex(this.wiredResult);

        const child = this.template.querySelector('c-data-table');
        if (child) {
            child.refreshTable(this.data);
        }
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Refreshed',
                message: 'Data refreshed successfully',
                variant: 'success'
            })
        );
    }
}