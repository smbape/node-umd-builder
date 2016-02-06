spTransform = require '../../src/spTransform'

assertStrictEqual = (code, expected)->
    assert.strictEqual spTransform(code), expected
    assert.strictEqual spTransform(expected), expected
    return

describe 'jsx extension', ->
    delegateEvents = [
        'blur'
        'change'
        'click'
        'drag'
        'drop'
        'focus'
        'input'
        'load'
        'mouseenter'
        'mouseleave'
        'mousemove'
        'propertychange'
        'reset'
        'scroll'
        'submit'

        'abort'
        'canplay'
        'canplaythrough'
        'durationchange'
        'emptied'
        'encrypted'
        'ended'
        'error'
        'loadeddata'
        'loadedmetadata'
        'loadstart'
        'pause'
        'play'
        'playing'
        'progress'
        'ratechange'
        'seeked'
        'seeking'
        'stalled'
        'suspend'
        'timeupdate'
        'volumechange'
        'waiting'
    ]

    it 'should transform sp[event]', ->
        for type in delegateEvents
            type = type[0].toUpperCase() + type.substring(1)

            code = """<button sp#{type}={ this.changeLanguage(event, lng) } />"""
            expected = """<button on#{type}={ (function(event) { this.changeLanguage(event, lng) }).bind(this) } />"""
            assertStrictEqual code, expected

            code = """<button type="button" sp#{type}={ this.changeLanguage(event, lng) } className="btn btn-default">
                { i18n.t('name', {lng: locale}) }
            </button>"""
            expected = """<button type="button" on#{type}={ (function(event) { this.changeLanguage(event, lng) }).bind(this) } className="btn btn-default">
                { i18n.t('name', {lng: locale}) }
            </button>"""

            code = """<button type="button" className="btn btn-default" sp#{type}={ this.changeLanguage(event, lng) }>
                { i18n.t('name', {lng: locale}) }
            </button>"""
            expected = """<button type="button" className="btn btn-default" on#{type}={ (function(event) { this.changeLanguage(event, lng) }).bind(this) }>
                { i18n.t('name', {lng: locale}) }
            </button>"""

            code = """<button sp#{type}={ this.changeLanguage(event, lng) } />"""
            expected = """<button on#{type}={ (function(event) { this.changeLanguage(event, lng) }).bind(this) } />"""
            assertStrictEqual code, expected

            code = """<button type="button" className="btn btn-default" sp#{type}={ this.changeLanguage(event, lng) }>
                {/* some comment */}
                { i18n.t('name', {lng: locale}) }
            </button>"""
            expected = """<button type="button" className="btn btn-default" on#{type}={ (function(event) { this.changeLanguage(event, lng) }).bind(this) }>
                {/* some comment */}
                { i18n.t('name', {lng: locale}) }
            </button>"""
            assertStrictEqual code, expected

            code = """freact = function() {
              return <button sp#{type}={ this.changeLanguage(event, lng) } />;
            };"""
            expected = """freact = function() {
              return <button on#{type}={ (function(event) { this.changeLanguage(event, lng) }).bind(this) } />;
            };"""
            assertStrictEqual code, expected

        return

    it 'should transform nested sp[event]', ->
        for type in delegateEvents
            type = type[0].toUpperCase() + type.substring(1)

            code = """<button type="button" className="btn btn-default" sp#{type}={ this.changeLanguage(event, lng) }>
                {/* some comment */}
                { i18n.t('name', {lng: locale}) }
                <button sp#{type}={ this.changeLanguage(event, lng) } />
            </button>"""
            expected = """<button type="button" className="btn btn-default" on#{type}={ (function(event) { this.changeLanguage(event, lng) }).bind(this) }>
                {/* some comment */}
                { i18n.t('name', {lng: locale}) }
                <button on#{type}={ (function(event) { this.changeLanguage(event, lng) }).bind(this) } />
            </button>"""
            assertStrictEqual code, expected

        return

    it 'should transform sp[event] + spRepeat', ->
        for type in delegateEvents
            type = type[0].toUpperCase() + type.substring(1)

            code = """<button spRepeat="(locale, lng) in locales" sp#{type}={ this.changeLanguage(event, lng) } />"""
            expected = """_.map(locales, function(locale, lng) {return (<button  on#{type}={ (function(event) { this.changeLanguage(event, lng) }).bind(this) } />)}.bind(this))"""
            assertStrictEqual code, expected
        return

    it 'should transform nested sp[event] + spRepeat', ->
        for type in delegateEvents
            type = type[0].toUpperCase() + type.substring(1)

            code = """<button spRepeat="(locale, lng) in locales" type="button" className="btn btn-default">
                { i18n.t('name', {lng: locale}) }
                <button spRepeat="(locale, lng) in locales" sp#{type}={ this.changeLanguage(event, lng) } />
            </button>"""
            expected = """_.map(locales, function(locale, lng) {return (<button  type="button" className="btn btn-default">
                { i18n.t('name', {lng: locale}) }
                { _.map(locales, function(locale, lng) {return (<button  on#{type}={ (function(event) { this.changeLanguage(event, lng) }).bind(this) } />)}.bind(this)) }
            </button>)}.bind(this))"""
            assertStrictEqual code, expected

            code = """var freact;

            freact = function() {
              return <button spRepeat="lng in locales" sp#{type}={ this.changeLanguage(event, lng) } />;
            };"""
            expected = """var freact;

            freact = function() {
              return _.map(locales, function(lng) {return (<button  on#{type}={ (function(event) { this.changeLanguage(event, lng) }).bind(this) } />)}.bind(this));
            };"""
            assertStrictEqual code, expected
        return

    it 'should transform spRepeat', ->
        code = """<button spRepeat="locale in locales"/>"""
        expected = """_.map(locales, function(locale) {return (<button />)}.bind(this))"""
        assertStrictEqual code, expected

        code = """<button spRepeat="(locale, lng) in locales"/>"""
        expected = """_.map(locales, function(locale, lng) {return (<button />)}.bind(this))"""
        assertStrictEqual code, expected

        code = """<button spRepeat="(locale, lng) in locales" type="button" className="btn btn-default" />"""
        expected = """_.map(locales, function(locale, lng) {return (<button  type="button" className="btn btn-default" />)}.bind(this))"""
        assertStrictEqual code, expected

        code = """<button spRepeat="(locale, lng) in locales" type="button" className="btn btn-default" ></button>"""
        expected = """_.map(locales, function(locale, lng) {return (<button  type="button" className="btn btn-default" ></button>)}.bind(this))"""
        assertStrictEqual code, expected

        code = """<button spRepeat="(locale, lng) in locales" type="button" className="btn btn-default">
            { i18n.t('name', {lng: locale}) }
        </button>"""
        expected = """_.map(locales, function(locale, lng) {return (<button  type="button" className="btn btn-default">
            { i18n.t('name', {lng: locale}) }
        </button>)}.bind(this))"""
        assertStrictEqual code, expected

        code = """<div>
            <button spRepeat="locale in locales"/>
            <button spRepeat="locale in locales"/>
        </div>"""

        expected = """<div>
            { _.map(locales, function(locale) {return (<button />)}.bind(this)) }
            { _.map(locales, function(locale) {return (<button />)}.bind(this)) }
        </div>"""
        assertStrictEqual code, expected

        return

    it 'should transform nested spRepeat', ->
        code = """<button spRepeat="(locale, lng) in locales" type="button" className="btn btn-default">
            { i18n.t('name', {lng: locale}) }
            <button spRepeat="(locale, lng) in locales" type="button" className="btn btn-default" ></button>
        </button>"""
        expected = """_.map(locales, function(locale, lng) {return (<button  type="button" className="btn btn-default">
            { i18n.t('name', {lng: locale}) }
            { _.map(locales, function(locale, lng) {return (<button  type="button" className="btn btn-default" ></button>)}.bind(this)) }
        </button>)}.bind(this))"""
        assertStrictEqual code, expected

        return

    it 'should transform spShow', ->
        code = """<button spShow={true}/>"""
        expected = """(true ? <button /> : '')"""
        assertStrictEqual code, expected

        code = """<button spShow={some(condition)}/>"""
        expected = """(some(condition) ? <button /> : '')"""
        assertStrictEqual code, expected

        return

    it 'should transform nested spClick + spRepeat + spShow', ->
        code = """<button spShow={true} spClick={ this.changeLanguage(event, lng) } />"""
        expected = """(true ? <button  onClick={ (function(event) { this.changeLanguage(event, lng) }).bind(this) } /> : '')"""
        assertStrictEqual code, expected

        code = """<button spShow={true} spRepeat="lng in locales"/>"""
        expected = """(true ? _.map(locales, function(lng) {return (<button  />)}.bind(this)) : '')"""
        assertStrictEqual code, expected

        code = """<button spRepeat="(locale, lng) in locales" type="button" className="btn btn-default">
            { i18n.t('name', {lng: locale}) }
            <button spShow={true} spRepeat="(locale, lng) in locales" spClick={ this.changeLanguage(event, lng) } />
        </button>"""
        expected = """_.map(locales, function(locale, lng) {return (<button  type="button" className="btn btn-default">
            { i18n.t('name', {lng: locale}) }
            { (true ? _.map(locales, function(locale, lng) {return (<button   onClick={ (function(event) { this.changeLanguage(event, lng) }).bind(this) } />)}.bind(this)) : '') }
        </button>)}.bind(this))"""
        assertStrictEqual code, expected

        return

    it 'should not transform', ->
        code = """<div {...this.props}/>"""
        assertStrictEqual code, code
        code = """var freact;

        freact = function() {
          return _.map(locales, function(lng) {return (<button  onClick={ (function(event) { this.changeLanguage(event, lng) }).bind(this) } />)}.bind(this));
        };"""
        assertStrictEqual code, code
        return

    return
