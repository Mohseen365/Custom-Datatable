import { LightningElement, api, track } from 'lwc';
import { updateRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class DataTable extends LightningElement {
    @api records;
    @api columns;

    @track filteredRecords = [];
    @track visibleRecords = [];
    @track draftValues = [];
    searchTerm = '';
    currentPage = 1;
    totalPages = 0;
    noData = false;

    pageSize = 10;

    @api
    refreshTable(data) {
        this.records = data;
        this.filteredRecords = [...data];
        this.currentPage = 1;
        this.setPagination();
    }

    connectedCallback() {
        if (this.records) {
            this.filteredRecords = [...this.records];
            this.setPagination();
        }
    }

    // Search
    handleSearch(event) {
        this.searchTerm = event.target.value.toLowerCase();
        if (this.searchTerm) {
            this.filteredRecords = this.records.filter(row =>
                Object.values(row).some(val =>
                    val && val.toString().toLowerCase().includes(this.searchTerm)
                )
            );
        } else {
            this.filteredRecords = [...this.records];
        }

        this.currentPage = 1;
        this.setPagination();
    }

    // Pagination logic
    setPagination() {
        this.totalPages = Math.ceil(this.filteredRecords.length / this.pageSize);

        // Set noData flag if empty
        this.noData = this.filteredRecords.length === 0;

        this.updateVisibleRecords();
    }

    updateVisibleRecords() {
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        this.visibleRecords = this.filteredRecords.slice(start, end);
    }

    handleNext() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.updateVisibleRecords();
        }
    }

    handlePrevious() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updateVisibleRecords();
        }
    }

    get disablePrevious() {
        return this.currentPage <= 1;
    }

    get disableNext() {
        return this.currentPage >= this.totalPages;
    }

    get pageInfo() {
        return `Page ${this.currentPage} of ${this.totalPages}`;
    }

    // INLINE SAVE HANDLER
    async handleSave(event) {
        const draftValues = event.detail.draftValues;

        try {
            const updatePromises = draftValues.map(record => {
                return updateRecord({ fields: { ...record } });
            });

            await Promise.all(updatePromises);

            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: 'Records updated successfully',
                    variant: 'success'
                })
            );

            this.draftValues = [];

            // Notify parent to refresh Apex
            this.dispatchEvent(new CustomEvent('refreshdata'));

        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: error.body?.message || 'Update failed',
                    variant: 'error'
                })
            );
        }
    }
}