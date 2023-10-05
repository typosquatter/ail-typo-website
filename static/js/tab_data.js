export const first_td = {
	delimiters: ['[[', ']]'],
	props: {
		current_var: Object,
        icon: String,
        title: String,
        original: Boolean
	},
	setup() {
		function addClipboard(val){
            navigator.clipboard.writeText(val);
            $("#alert-clip").fadeTo(2000, 500).slideUp(500, function() {
                $("#alert-clip").slideUp(500);
            })
        }

		return { addClipboard }
	},
	template: `
        <b :title="title">[[icon]]</b>
        [[current_var["permutation"] ]]
        <button v-if="original" @click="addClipboard(current_var['permutation'])" class="btn btn-light" title="Copy this domain to clipboard" style="background-color: #e9ecef;border: #e9ecef">🔗</button>
        <button v-else @click="addClipboard(current_var['permutation'])" class="btn btn-light" title="Copy this domain to clipboard" style="background-color: #ffffff">🔗</button>
        <a id="link" target="_blank" :href="'http://' + current_var['permutation']" title="Go to webpage">
            <i class="fa fa-external-link" aria-hidden="true"></i>
        </a>
        <br>
        <sup>[[current_var["variation"] ]]</sup>
	`
};

export const ip_td = {
	delimiters: ['[[', ']]'],
	props: {
		current_var: Object
	},
	setup() {
		return { collapse_id:  Math.random()}
	},
	template: `
        <div v-if="'A' in current_var">
            [[ (current_var["A"] || [''])[0] ]]
            <span id="span_length" v-if="current_var['A'].length - 1 >= 1">
                <a data-bs-toggle="collapse" :href="'#collapse_' + collapse_id" role="button" aria-expanded="false" :aria-controls="'collapse_' + collapse_id">
                    [[ (current_var['A'].length - 1).toString() ]] more...
                </a>
            </span>
            <div class="collapse" :id="'collapse_' + collapse_id">
                <div class="card card-body">
                    <template v-for="i in current_var['A']">
                        <template v-if="i != current_var['A'][0]">[[i]]</template>
                        <br>
                    </template>
                </div>
            </div>
        </div>
        <div v-if="'AAAA' in current_var">
            [[ (current_var["AAAA"] || [''])[0] ]]
            <span id="span_length" v-if="current_var['AAAA'].length - 1 >= 1">
                <a data-bs-toggle="collapse" :href="'#collapse6_' + collapse_id" role="button" aria-expanded="false" :aria-controls="'collapse6_' + collapse_id">
                    [[ (current_var['AAAA'].length - 1).toString() ]] more...
                </a>
            </span>
            <div class="collapse" :id="'collapse6_' + collapse_id">
                <div class="card card-body">
                    <template v-for="i in current_var['AAAA']">
                        <template v-if="i != current_var['AAAA'][0]">[[i]]</template>
                        <br>
                    </template>
                </div>
            </div>
        </div>
        <sup v-if="'geoip' in current_var"> [[ current_var["geoip"] || '' ]]</sup>
	`
};

export const ns_td = {
	delimiters: ['[[', ']]'],
	props: {
		current_var: Object
	},
	setup() {
        return { collapse_id:  Math.random()}
	},
	template: `
        <template v-if="'NS' in current_var">
            [[ (current_var["NS"] || [''])[0] ]]
            <br>
            <span id="span_length" v-if="current_var['NS'].length - 1 >= 1">
                <a data-bs-toggle="collapse" :href="'#collapseNS_' + collapse_id" role="button" aria-expanded="false" :aria-controls="'collapseNS_' + collapse_id">
                    [[ (current_var['NS'].length - 1).toString() ]] more...
                </a>
            </span>
            <div class="collapse" :id="'collapseNS_' + collapse_id">
                <div class="card card-body">
                    <template v-for="i in current_var['NS']">
                        <template v-if="i != current_var['NS'][0]">[[i]]</template>
                        <br>
                    </template>
                </div>
            </div>
        </template>
	`
};

export const mx_td = {
	delimiters: ['[[', ']]'],
	props: {
		current_var: Object
	},
	setup() {
        return { collapse_id:  Math.random()}
	},
	template: `
        <div v-if="'MX' in current_var">
            [[ (current_var["MX"] || [''])[0] ]]
            <br>
            <span id="span_length" v-if="current_var['MX'].length - 1 >= 1">
                <a data-bs-toggle="collapse" :href="'#collapseMX_' + collapse_id" role="button" aria-expanded="false" :aria-controls="'collapseMX_' + collapse_id">
                    [[ (current_var['MX'].length - 1).toString() ]] more...
                </a>
            </span>
            <div class="collapse" :id="'collapseMX_' + collapse_id">
                <div class="card card-body">
                    <template v-for="i in current_var['MX']">
                        <template v-if="i != current_var['MX'][0]">[[i]]</template>
                        <br>
                    </template>
                </div>
            </div>
        </div>
	`
};

export const website_title = {
	delimiters: ['[[', ']]'],
	props: { current_var: Object },
	template: `
        [[ current_var["website_title"] || '' ]]
	`
};

export const website_sim = {
	delimiters: ['[[', ']]'],
	props: { current_var: Object },
	template: `
        [[ current_var["website_sim"] ? current_var["website_sim"] + ' %': '']]
	`
};

export const ressource_diff = {
	delimiters: ['[[', ']]'],
	props: { current_var: Object },
	template: `
        [[ current_var["ressource_diff"] ? current_var["ressource_diff"] + ' %': '']]
	`
};

export const ratio = {
	delimiters: ['[[', ']]'],
	props: { current_var: Object },
	template: `
        [[ current_var["ratio"] || current_var["ratio"] == '0' ? current_var["ratio"] + ' %': '']]
	`
};


export default ip_td