import { LightningElement, wire } from 'lwc';
import getDynamicData from '@salesforce/apex/DynamicDataTableController.getDynamicData';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class DataWrapper extends LightningElement {
    data;
    columns;
    error;

    request = {
        objectName: 'Account',
        fields: ['Name', 'Industry', 'Phone'],
        whereClause: '',
        limitSize: 20
    };

    // Convert to JSON string for Apex
    get jsonRequest() {
        return JSON.stringify(this.request);
    }

    @wire(getDynamicData, { request: '$jsonRequest' })
    wiredData({ data, error }) {
        if (data) {
            this.columns = data.columns;
            this.data = data.rows;
            this.error = undefined;

            // Success toast when data fetched
            this.showToast('Success', 'Data fetched successfully', 'success');

            // If no records found, show info toast
            if (!this.data || this.data.length === 0) {
                this.showToast('No Records Found', 'No matching records were found.', 'info');
            }
        } else if (error) {
            this.error = error;
            this.data = undefined;
            this.columns = undefined;

            console.error('Error fetching data', error);

            // Error toast
            this.showToast('Error', 'Failed to fetch data. Check console for details.', 'error');
        }
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title,
            message,
            variant,
            mode: 'dismissable'
        });
        this.dispatchEvent(event);
    }
}