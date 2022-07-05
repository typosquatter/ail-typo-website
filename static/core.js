last_registered = 0;
    
function fetchDomains() {
    $.getJSON('/domains/' + $('#sid').val(), function(data) {
        $('#data').empty();
        $('<tr>').html(
                '<th>PERMUTATION</th>' +
                '<th>IP ADDRESS</th>' +
                '<th>NAME SERVER</th>' +
                '<th>MAIL SERVER</th>'
            ).appendTo('#data');
        $.each(data, function(i, item) {
            for(j in item){
                variation = item['variation'] || ''
                permutation = j || ''
                ipaddr = [
                    (item[j]['A'] || [''])[0],
                    (item[j]['AAAA'] || [''])[0],
                ].filter(Boolean).join('</br>');
                dns_ns = (item[j]['NS'] || [''])[0];
                dns_mx = (item[j]['MX'] || [''])[0];
                geoip = item[j]['geoip'] || '';
                $('<tr>').html(
                    '<td>' + permutation + '  <a href="http://' + permutation + '" id="link" target="_blank">🔗</a></br><sup>' + variation + '</sup></td>' +
                    '<td>' + ipaddr + '</br><sup>' + geoip + '</sup></td>' +
                    '<td>' + dns_ns + '</td>' +
                    '<td>' + dns_mx + '</td>'
                ).appendTo('#data');
            }
            
        });
    });
}

function pollScan() {
    $.getJSON('/status/' + $('#sid').val(), function(data) {
        $('#status').html('Processed ' + data['complete'] + ' of ' + data['total']);
        $('#progress').val(data['complete']/data['total']);
        if (data['remaining'] > 0) {
            setTimeout(pollScan, 250);
        } else {
            sid = $('#sid').val()
            $('#status').html('Scanned <a href="/api/scans/' + sid + '/list">' + data['complete'] + '</a> suspicious domains. Identified ' + data['registered'] + ' registered: download as <a href="/download/' + sid + '/json">JSON</a>');
            $('#scan').text('Scan');
        }
        if (last_registered < data['registered']) {
            last_registered = data['registered']
            fetchDomains();
        }
    });
}

function actionScan() {
    if (!$('#url').val()) {
        $('#status').html('↖ You need to type in a domain name first');
        return
    }

    if ($('#scan').text() == 'Scan') {
        last_registered = 0;
        $('#scan').text('⏱');
        
        data_dict = {}
        data_dict['url'] = $('#url').val()
        flag = false
        if (document.getElementById("runAll").checked){
            data_dict['runAll'] = $('#runAll').val()
            flag = true
        }else{
            if (document.getElementById("charom").checked){
                data_dict['charom'] = $('#charom').val()
                flag = true
            }if (document.getElementById("rep").checked){
                data_dict['rep'] = $('#rep').val()
                flag = true
            }if (document.getElementById("trans").checked){
                data_dict['trans'] = $('#trans').val()
                flag = true
            }if (document.getElementById("repl").checked){
                data_dict['repl'] = $('#repl').val()
                flag = true
            }if (document.getElementById("dr").checked){
                data_dict['dr'] = $('#dr').val()
                flag = true
            }if (document.getElementById("inser").checked){
                data_dict['inser'] = $('#inser').val()
                flag = true
            }if (document.getElementById("add").checked){
                data_dict['add'] = $('#add').val()
                flag = true
            }if (document.getElementById("md").checked){
                data_dict['md'] = $('#md').val()
                flag = true
            }if (document.getElementById("sd").checked){
                data_dict['sd'] = $('#sd').val()
                flag = true
            }if (document.getElementById("vs").checked){
                data_dict['vs'] = $('#vs').val()
                flag = true
            }if (document.getElementById("hyph").checked){
                data_dict['hyph'] = $('#hyph').val()
                flag = true
            }if (document.getElementById("bs").checked){
                data_dict['bs'] = $('#bs').val()
                flag = true
            }if (document.getElementById("homog").checked){
                data_dict['homog'] = $('#homog').val()
                flag = true
            }if (document.getElementById("cm").checked){
                data_dict['cm'] = $('#cm').val()
                flag = true
            }if (document.getElementById("homoph").checked){
                data_dict['homoph'] = $('#homoph').val()
                flag = true
            }if (document.getElementById("wt").checked){
                data_dict['wt'] = $('#wt').val()
                flag = true
            }if (document.getElementById("addtld").checked){
                data_dict['addtld'] = $('#addtld').val()
                flag = true
            }if (document.getElementById("sub").checked){
                data_dict['sub'] = $('#sub').val()
                flag = true
            }if (document.getElementById("sp").checked){
                data_dict['sp'] = $('#sp').val()
                flag = true
            }if (document.getElementById("cdh").checked){
                data_dict['cdh'] = $('#cdh').val()
                flag = true
            }
        }

        if(!flag){
            data_dict['runAll'] = $('#runAll').val()
        }

        $.post({
            url: '/typo',
            data: JSON.stringify({
                data_dict
            }),
            contentType: 'application/json',
            success: function(data) {
                $('#sid').val(data['id']);
                $('#scan').text('Stop');
                pollScan();
            },
            error: function(xhr, status, error) {
                $('#scan').text('Scan');
                $('#status').html(xhr.responseJSON['message'] || 'Something went wrong');
            },
        });
    } else {
        stop();
        $.post({
            url: '/stop',
            contentType: 'application/json',
            success: function() {
                $('#scan').text('Scan');
            }
        });
    }
}

$('#scan').click(function() {
    actionScan();
});

$('#url').on('keypress',function(e) {
    if(e.which == 13) {
        actionScan();
    }
});

function runAll(){
    if (document.getElementById("runAll").checked){
        $("#charom").prop("disabled", true)
        $("#rep").prop("disabled", true)
        $("#trans").prop("disabled", true)
        $("#repl").prop("disabled", true)
        $("#dr").prop("disabled", true)
        $("#inser").prop("disabled", true)
        $("#add").prop("disabled", true)
        $("#md").prop("disabled", true)
        $("#sd").prop("disabled", true)
        $("#vs").prop("disabled", true)
        $("#hyph").prop("disabled", true)
        $("#bs").prop("disabled", true)
        $("#homog").prop("disabled", true)
        $("#cm").prop("disabled", true)
        $("#homoph").prop("disabled", true)
        $("#wt").prop("disabled", true)
        $("#addtld").prop("disabled", true)
        $("#sub").prop("disabled", true)
        $("#sp").prop("disabled", true)
        $("#cdh").prop("disabled", true)
    }else{
        $("#charom").prop("disabled", false)
        $("#rep").prop("disabled", false)
        $("#trans").prop("disabled", false)
        $("#repl").prop("disabled", false)
        $("#dr").prop("disabled", false)
        $("#inser").prop("disabled", false)
        $("#add").prop("disabled", false)
        $("#md").prop("disabled", false)
        $("#sd").prop("disabled", false)
        $("#vs").prop("disabled", false)
        $("#hyph").prop("disabled", false)
        $("#bs").prop("disabled", false)
        $("#homog").prop("disabled", false)
        $("#cm").prop("disabled", false)
        $("#homoph").prop("disabled", false)
        $("#wt").prop("disabled", false)
        $("#addtld").prop("disabled", false)
        $("#sub").prop("disabled", false)
        $("#sp").prop("disabled", false)
        $("#cdh").prop("disabled", false)
    }
};