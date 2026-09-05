public with sharing class DynamicDataTableController {
    public class DataRequest {
        @AuraEnabled public String objectName;
        @AuraEnabled public List<String> fields;
        @AuraEnabled public String whereClause;
        @AuraEnabled public Integer limitSize;
    }

    public class DataResponse {
        @AuraEnabled public List<Map<String, Object>> rows;
        @AuraEnabled public List<ColumnMeta> columns;
    }

    public class ColumnMeta {
        @AuraEnabled public String label;
        @AuraEnabled public String fieldName;
        @AuraEnabled public String type;
    }

    @AuraEnabled(cacheable=true)
    public static DataResponse getDynamicData(String request) {
        System.debug('Raw request string: ' + request);

        if (String.isBlank(request)) {
            throw new AuraHandledException('Request body is missing.');
        }

        // Explicitly deserialize JSON string to Apex object
        DataRequest parsedRequest = (DataRequest) JSON.deserialize(request, DataRequest.class);

        System.debug('Parsed Request: ' + JSON.serialize(parsedRequest));

        if (String.isBlank(parsedRequest.objectName)) {
            throw new AuraHandledException('Object name is required.');
        }

        if (parsedRequest.fields == null || parsedRequest.fields.isEmpty()) {
            throw new AuraHandledException('At least one field must be provided.');
        }

        // Validation and Query Building (same as before)
        Map<String, Schema.SObjectType> schemaMap = Schema.getGlobalDescribe();
        if (!schemaMap.containsKey(parsedRequest.objectName)) {
            throw new AuraHandledException('Invalid object name: ' + parsedRequest.objectName);
        }

        Map<String, Schema.SObjectField> fieldMap = schemaMap
            .get(parsedRequest.objectName)
            .getDescribe()
            .fields.getMap();

        List<String> validFields = new List<String>();
        List<ColumnMeta> columns = new List<ColumnMeta>();

        for (String field : parsedRequest.fields) {
            if (fieldMap.containsKey(field)) {
                validFields.add(field);
                Schema.DescribeFieldResult describeField = fieldMap.get(field).getDescribe();

                ColumnMeta col = new ColumnMeta();
                col.label = describeField.getLabel();
                col.fieldName = field;
                col.type = getLwcFieldType(describeField);
                columns.add(col);
            }
        }

        if (validFields.isEmpty()) {
            throw new AuraHandledException('No valid fields found for ' + parsedRequest.objectName);
        }

        Boolean idExists = false;

        for (String field : validFields) {
            if (field.equalsIgnoreCase('Id')) {
                idExists = true;
                break;
            }
        }

        if (!idExists) {
            validFields.add('Id');
        }
        
        String sanitizedObjectName = String.escapeSingleQuotes(parsedRequest.objectName);
        String soql = 'SELECT ' + String.join(validFields, ',') + ' FROM ' + sanitizedObjectName + ' WITH SECURITY_ENFORCED';

        if (!String.isBlank(parsedRequest.whereClause)) {
            soql += ' WHERE ' + parsedRequest.whereClause;
        }

        Integer limitVal = (parsedRequest.limitSize != null && parsedRequest.limitSize > 0)
            ? Math.min(parsedRequest.limitSize, 2000)
            : 200;
        soql += ' LIMIT ' + limitVal;

        System.debug('SOQL Query: ' + soql);

        List<SObject> records;
        try {
            records = Database.query(soql);
        } catch (Exception e) {
            throw new AuraHandledException('Error executing query: ' + e.getMessage());
        }

        List<Map<String, Object>> dataList = new List<Map<String, Object>>();
        for (SObject s : records) {
            Map<String, Object> recordMap = new Map<String, Object>();
            for (String field : validFields) {
                recordMap.put(field, s.get(field));
            }
            dataList.add(recordMap);
        }

        DataResponse response = new DataResponse();
        response.rows = dataList;
        response.columns = columns;

        return response;
    }

    public class PicklistOption implements Comparable {

        @AuraEnabled public String label;
        @AuraEnabled public String value;
    
        public PicklistOption(String label, String value) {
            this.label = label;
            this.value = value;
        }
    
        public Integer compareTo(Object compareTo) {
            PicklistOption other = (PicklistOption) compareTo;
        
            if (other == null) return 1;
            if (this.label == null && other.label == null) return 0;
            if (this.label == null) return -1;
            if (other.label == null) return 1;
        
            return this.label.toLowerCase().compareTo(other.label.toLowerCase());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<PicklistOption> getAllObjects() {

        Map<String, Schema.SObjectType> globalMap = Schema.getGlobalDescribe();
        List<PicklistOption> objectList = new List<PicklistOption>();

        for (Schema.SObjectType objType : globalMap.values()) {

            Schema.DescribeSObjectResult describe = objType.getDescribe();

            if (describe.isQueryable() && describe.isAccessible()) {
                objectList.add(
                    new PicklistOption(describe.getLabel(), describe.getName())
                );
            }
        }

        objectList.sort();
        return objectList;
    }

    @AuraEnabled(cacheable=true)
    public static List<PicklistOption> getObjectFields(String objectName) {
    
        if (String.isBlank(objectName)) {
            throw new AuraHandledException('Object name required');
        }
    
        Map<String, Schema.SObjectType> globalMap = Schema.getGlobalDescribe();
    
        if (!globalMap.containsKey(objectName)) {
            throw new AuraHandledException('Invalid object name');
        }
    
        Schema.DescribeSObjectResult objDescribe =
            globalMap.get(objectName).getDescribe();
    
        // Ensure object is queryable
        if (!objDescribe.isQueryable()) {
            throw new AuraHandledException('Object is not queryable');
        }
    
        Map<String, Schema.SObjectField> fieldMap =
            objDescribe.fields.getMap();
    
        List<PicklistOption> fieldList = new List<PicklistOption>();
    
        for (Schema.SObjectField field : fieldMap.values()) {
    
            Schema.DescribeFieldResult describeField = field.getDescribe();
    
            if (describeField.isAccessible()
                && !describeField.isCalculated()
                && !describeField.isAutoNumber()
                && describeField.getType() != Schema.DisplayType.Address
                && describeField.getType() != Schema.DisplayType.Location) {
    
                fieldList.add(
                    new PicklistOption(
                        describeField.getLabel(),
                        describeField.getName()
                    )
                );
            }
        }
    
        fieldList.sort();
    
        return fieldList;
    }

    @AuraEnabled
    public static Id insertRecord(String objectName, Map<String, Object> fields) {
        if (String.isBlank(objectName)) {
            throw new AuraHandledException('Object name is required.');
        }

        Schema.SObjectType targetType = Schema.getGlobalDescribe().get(objectName);
        if (targetType == null) {
            throw new AuraHandledException('Invalid object name: ' + objectName);
        }

        Schema.DescribeSObjectResult describe = targetType.getDescribe();
        if (!describe.isCreateable()) {
            throw new AuraHandledException('Create access denied for object: ' + objectName);
        }

        SObject obj = targetType.newSObject();
        Map<String, Schema.SObjectField> fieldMap = describe.fields.getMap();

        if (fields != null) {
            for (String key : fields.keySet()) {
                if (fieldMap.containsKey(key)) {
                    Schema.DescribeFieldResult fieldDescribe = fieldMap.get(key).getDescribe();
                    if (fieldDescribe.isCreateable()) {
                        obj.put(key, fields.get(key));
                    }
                }
            }
        }

        insert obj;
        return obj.Id;
    }

    @AuraEnabled
    public static void deleteRecordById(Id recordId) {
        if (recordId == null) {
            throw new AuraHandledException('Record ID is required.');
        }

        Schema.SObjectType targetType = recordId.getSObjectType();
        Schema.DescribeSObjectResult describe = targetType.getDescribe();

        if (!describe.isDeletable()) {
            throw new AuraHandledException('Delete access denied for object: ' + describe.getName());
        }

        delete targetType.newSObject(recordId);
    }

    @AuraEnabled
    public static void bulkUpdate(String objectName, List<Id> recordIds, Map<String, Object> values) {
        if (String.isBlank(objectName)) {
            throw new AuraHandledException('Object name is required.');
        }

        if (recordIds == null || recordIds.isEmpty()) {
            throw new AuraHandledException('No record IDs provided.');
        }

        Schema.SObjectType targetType = Schema.getGlobalDescribe().get(objectName);
        if (targetType == null) {
            throw new AuraHandledException('Invalid object name: ' + objectName);
        }

        Schema.DescribeSObjectResult describe = targetType.getDescribe();
        if (!describe.isUpdateable()) {
            throw new AuraHandledException('Update access denied for object: ' + objectName);
        }

        Map<String, Schema.SObjectField> fieldMap = describe.fields.getMap();
        List<SObject> updates = new List<SObject>();

        for (Id recordId : recordIds) {
            SObject obj = targetType.newSObject(recordId);
            if (values != null) {
                for (String field : values.keySet()) {
                    if (fieldMap.containsKey(field)) {
                        Schema.DescribeFieldResult fieldDescribe = fieldMap.get(field).getDescribe();
                        if (fieldDescribe.isUpdateable()) {
                            obj.put(field, values.get(field));
                        }
                    }
                }
            }
            updates.add(obj);
        }

        if (!updates.isEmpty()) {
            update updates;
        }
    }

    private static String getLwcFieldType(Schema.DescribeFieldResult fieldDescribe) {
        Schema.DisplayType fieldType = fieldDescribe.getType();

        switch on fieldType {
            when Email      { return 'email'; }
            when Phone      { return 'phone'; }
            when Url        { return 'url'; }
            when Currency   { return 'currency'; }
            when Double     { return 'number'; }
            when Integer    { return 'number'; }
            when Percent    { return 'percent'; }
            when Boolean    { return 'boolean'; }
            when Date       { return 'date'; }
            when DateTime   { return 'date'; }
            when else       { return 'text'; }
        }
    }

    @AuraEnabled
    public static void saveRecords(String objectName, List<Map<String, Object>> records) {

        if (String.isBlank(objectName)) {
            throw new AuraHandledException('Object name is required.');
        }

        if (records == null || records.isEmpty()) {
            throw new AuraHandledException('No records provided.');
        }

        Map<String, Schema.SObjectType> globalMap = Schema.getGlobalDescribe();

        if (!globalMap.containsKey(objectName)) {
            throw new AuraHandledException('Invalid object name: ' + objectName);
        }

        Schema.SObjectType targetType = globalMap.get(objectName);
        Schema.DescribeSObjectResult describe = targetType.getDescribe();

        if (!describe.isUpdateable()) {
            throw new AuraHandledException('Update access denied for object: ' + objectName);
        }

        Map<String, Schema.SObjectField> fieldMap = describe.fields.getMap();
        List<SObject> updates = new List<SObject>();

        for (Map<String, Object> rec : records) {

            if (rec == null || !rec.containsKey('Id')) {
                continue;
            }

            Id recordId = (Id) rec.get('Id');

            if (recordId == null) {
                continue;
            }

            SObject obj = targetType.newSObject(recordId);

            for (String key : rec.keySet()) {
                if (key != 'Id' && rec.get(key) != null && fieldMap.containsKey(key)) {
                    Schema.DescribeFieldResult fieldDescribe = fieldMap.get(key).getDescribe();
                    if (fieldDescribe.isUpdateable()) {
                        obj.put(key, rec.get(key));
                    }
                }
            }

            updates.add(obj);
        }

        if (!updates.isEmpty()) {
            update updates;
        }
    }


}