import { LightningElement, api, track } from 'lwc';
import { updateRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import saveRecords from '@salesforce/apex/DynamicDataTableController.saveRecords';

export default class DataTable extends NavigationMixin(LightningElement) {
    @api records;
    @api columns;
    @api objectName;

    @track filteredRecords = [];
    @track visibleRecords = [];
    @track draftValues = [];
    @track editRecord = {};
    @track editFields = [];
    @track newRecord = {};
    @track selectedRows = [];
    @track bulkValues = {};
    @track selectedRowIds = [];
    @track sortedBy;
    sortDirection = 'asc';
    showBulkModal = false;
    searchTerm = '';
    currentPage = 1;
    totalPages = 0;
    noData = false;
    showModal = false;
    pageSize = 10;
    showCreateModal = false;

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
    get disablePrevious() {
        return this.currentPage <= 1;
    }

    get disableNext() {
        return this.currentPage >= this.totalPages;
    }

    get pageInfo() {
        return `Page ${this.currentPage} of ${this.totalPages}`;
    }

    get computedColumns() {
        return [
            ...this.columns,
            {
                type: 'action',
                typeAttributes: {
                    rowActions: [
                        { label: 'View', name: 'view' },
                        { label: 'Edit', name: 'edit' },
                        { label: 'Delete', name: 'delete' }
                    ]
                }
            }
        ];
    }

    get disableBulk() {
        return this.selectedRows.length < 2;
    }

    handleSort(event) {
        const { fieldName, sortDirection } = event.detail;
        this.sortedBy = fieldName;
        this.sortDirection = sortDirection;
    
        this.filteredRecords = [...this.filteredRecords].sort((a, b) => {
            let v1 = a[fieldName] || '';
            let v2 = b[fieldName] || '';
            return sortDirection === 'asc'
                ? (v1 > v2 ? 1 : -1)
                : (v1 < v2 ? 1 : -1);
        });
    
        this.currentPage = 1;
        this.setPagination();
    }

    handleRowSelection(event) {
        this.selectedRows = event.detail.selectedRows;
        this.selectedRowIds = this.selectedRows.map(row => row.Id);
    }
    openBulkModal() {
        this.bulkValues = {};
        this.editFields = this.columns;
        this.showBulkModal = true;
    }
    
    closeBulkModal() {
        this.showBulkModal = false;
    }
    
    handleBulkChange(event) {
        const field = event.target.dataset.field;
        this.bulkValues[field] = event.target.value;
    }
    
    applyBulkUpdate() {
        const payload = {
            recordIds: this.selectedRows.map(r => r.Id),
            values: this.bulkValues
        };
    
        this.dispatchEvent(
            new CustomEvent('bulkupdate', { detail: payload })
        );
    
        this.showBulkModal = false;
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

    handleRowAction(event) {
        const action = event.detail.action.name;
        const row = event.detail.row;
        
        if (action === 'view') {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: row.Id,
                actionName: 'view'
            }
        });
    }
    
        if (action === 'edit') {
            this.openEditModal(row);
        }
    
        if (action === 'delete') {
            this.handleDelete(row.Id);
        }
    }
    
    handleFieldChange(event) {
        const field = event.target.dataset.field;
        const value = event.target.value;
        console.log('field -> ', field);
        console.log('value -> ', value);
            
        this.editRecord = {
            ...this.editRecord,
            [field]: value
        };
    
        this.editFields = this.editFields.map(f => {
            if (f.fieldName === field) {
                return { ...f, value };
            }
            return f;
        });

        
        console.log('editFields -> ', this.editFields);
    } 

    handleCreateFieldChange(event) {
        const field = event.target.dataset.field;
        this.newRecord[field] = event.target.value;
    }
    
    handleDelete(recordId) {
        if (confirm('Are you sure you want to delete this record?')) {
            this.dispatchEvent(
                new CustomEvent('deleterecord', { detail: recordId })
            );
        }
    }
    
    openEditModal(row) {
        this.editRecord = { ...row };
        this.editFields = this.columns
            .filter(col => col.editable) 
            .map(col => {
                return {
                    fieldName: col.fieldName,
                    label: col.label,
                    value: row[col.fieldName] 
                };
            });
        this.showModal = true;
    }
    
    closeModal() {
        this.showModal = false;
        this.editFields = [];
        this.editRecord = {};
    }

    openNewModal() {
        this.newRecord = {};
        this.editFields = this.columns;
        this.showCreateModal = true;
    }
    
    closeCreateModal() {
        this.showCreateModal = false;
    }

    saveNewRecord() {
        this.dispatchEvent(
            new CustomEvent('createrecord', { detail: this.newRecord })
        );
        this.showCreateModal = false;
    }

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


    async handleSave(event) {
        

        try {
            await saveRecords({
                objectName: this.objectName,
                records: event.detail.draftValues
            });

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

    async saveModal() {
        try {
            await updateRecord({ fields: this.editRecord });
    
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Updated',
                    message: 'Record updated successfully',
                    variant: 'success'
                })
            );
    
            this.showModal = false;
            this.dispatchEvent(new CustomEvent('refreshdata'));
    
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: error.body?.message || 'Save failed',
                    variant: 'error'
                })
            );
        }
    }
    
}