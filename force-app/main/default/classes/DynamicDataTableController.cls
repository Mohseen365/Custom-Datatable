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

        if (!validFields.contains('Id')) {
            validFields.add('Id');
        }
        
        String soql = 'SELECT ' + String.join(validFields, ',') + ' FROM ' + parsedRequest.objectName + ' WITH SECURITY_ENFORCED';

        if (!String.isBlank(parsedRequest.whereClause)) {
            soql += ' WHERE ' + parsedRequest.whereClause;
        }

        if (parsedRequest.limitSize != null && parsedRequest.limitSize > 0) {
            soql += ' LIMIT ' + parsedRequest.limitSize;
        } else {
            soql  += ' LIMIT 200';
        }

        System.debug('SOQL Query: ' + soql);

        List<SObject> records = Database.query(soql);

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

    @AuraEnabled
    public static Id insertRecord(String objectName, Map<String, Object> fields) {
        SObject obj = Schema.getGlobalDescribe().get(objectName).newSObject();
        for (String key : fields.keySet()) {
            obj.put(key, fields.get(key));
        }
        insert obj;
        return obj.Id;
    }


    @AuraEnabled
    public static void deleteRecordById(Id recordId) {
        if (recordId == null) return;

        delete recordId.getSObjectType().newSObject(recordId);
    }
    @AuraEnabled
    public static void bulkUpdate(String objectName, List<Id> recordIds, Map<String, Object> values) {
        List<SObject> updates = new List<SObject>();

        for (Id recordId : recordIds) {
            SObject obj = Schema.getGlobalDescribe().get(objectName).newSObject(recordId);
            for (String field : values.keySet()) {
                obj.put(field, values.get(field));
            }
            updates.add(obj);
        }

        update updates;
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

        List<SObject> updates = new List<SObject>();

        for (Map<String, Object> rec : records) {

            if (rec == null || !rec.containsKey('Id')) {
                continue;
            }

            Id recordId = (Id) rec.get('Id');

            if (recordId == null) {
                continue;
            }

            SObject obj = globalMap.get(objectName).newSObject(recordId);

            for (String key : rec.keySet()) {
                if (key != 'Id' && rec.get(key) != null) {
                    obj.put(key, rec.get(key));
                }
            }

            updates.add(obj);
        }

        if (!updates.isEmpty()) {
            update updates;
        }
    }


}