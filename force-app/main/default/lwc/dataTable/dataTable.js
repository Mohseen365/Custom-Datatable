import { LightningElement, api, track } from 'lwc';

export default class DataTable extends LightningElement {
    @api records;
    @api columns;

    @track filteredRecords = [];
    @track visibleRecords = [];
    searchTerm = '';
    currentPage = 1;
    totalPages = 0;
    noData = false;

    pageSize = 10;

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
}