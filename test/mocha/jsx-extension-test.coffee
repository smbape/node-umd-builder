spTransform = require '../../src/spTransform'

describe 'jsx extension', ->

    it 'should transform spClick', ->
        code = """<button spClick={ this.changeLanguage(event, lng) } />"""
        expected = """<button onClick={ (function(event) { this.changeLanguage(event, lng) }).bind(this) } />"""
        assert.strictEqual spTransform(code), expected

        code = """<button type="button" spClick={ this.changeLanguage(event, lng) } className="btn btn-default">
            { i18n.t('name', {lng: locale}) }
        </button>"""
        expected = """<button type="button" onClick={ (function(event) { this.changeLanguage(event, lng) }).bind(this) } className="btn btn-default">
            { i18n.t('name', {lng: locale}) }
        </button>"""

        code = """<button type="button" className="btn btn-default" spClick={ this.changeLanguage(event, lng) }>
            { i18n.t('name', {lng: locale}) }
        </button>"""
        expected = """<button type="button" className="btn btn-default" onClick={ (function(event) { this.changeLanguage(event, lng) }).bind(this) }>
            { i18n.t('name', {lng: locale}) }
        </button>"""

        code = """<button spClick={ this.changeLanguage(event, lng) } />"""
        expected = """<button onClick={ (function(event) { this.changeLanguage(event, lng) }).bind(this) } />"""
        assert.strictEqual spTransform(code), expected

        code = """<button type="button" className="btn btn-default" spClick={ this.changeLanguage(event, lng) }>
            {/* some comment */}
            { i18n.t('name', {lng: locale}) }
        </button>"""
        expected = """<button type="button" className="btn btn-default" onClick={ (function(event) { this.changeLanguage(event, lng) }).bind(this) }>
            {/* some comment */}
            { i18n.t('name', {lng: locale}) }
        </button>"""
        assert.strictEqual spTransform(code), expected

        code = """freact = function() {
          return <button spClick={ this.changeLanguage(event, lng) } />;
        };"""
        expected = """freact = function() {
          return <button onClick={ (function(event) { this.changeLanguage(event, lng) }).bind(this) } />;
        };"""
        assert.strictEqual spTransform(code), expected

        return

    it 'should transform nested spClick', ->
        code = """<button type="button" className="btn btn-default" spClick={ this.changeLanguage(event, lng) }>
            {/* some comment */}
            { i18n.t('name', {lng: locale}) }
            <button spClick={ this.changeLanguage(event, lng) } />
        </button>"""
        expected = """<button type="button" className="btn btn-default" onClick={ (function(event) { this.changeLanguage(event, lng) }).bind(this) }>
            {/* some comment */}
            { i18n.t('name', {lng: locale}) }
            <button onClick={ (function(event) { this.changeLanguage(event, lng) }).bind(this) } />
        </button>"""
        assert.strictEqual spTransform(code), expected

        return

    it 'should transform spRepeat', ->
        code = """<button spRepeat="locale in locales"/>"""
        expected = """_.map(locales, function(locale) {return (<button />)}.bind(this))"""
        assert.strictEqual spTransform(code), expected

        code = """<button spRepeat="(locale, lng) in locales"/>"""
        expected = """_.map(locales, function(locale, lng) {return (<button />)}.bind(this))"""
        assert.strictEqual spTransform(code), expected

        code = """<button spRepeat="(locale, lng) in locales" type="button" className="btn btn-default" />"""
        expected = """_.map(locales, function(locale, lng) {return (<button  type="button" className="btn btn-default" />)}.bind(this))"""
        assert.strictEqual spTransform(code), expected

        code = """<button spRepeat="(locale, lng) in locales" type="button" className="btn btn-default" ></button>"""
        expected = """_.map(locales, function(locale, lng) {return (<button  type="button" className="btn btn-default" ></button>)}.bind(this))"""
        assert.strictEqual spTransform(code), expected

        code = """<button spRepeat="(locale, lng) in locales" type="button" className="btn btn-default">
            { i18n.t('name', {lng: locale}) }
        </button>"""
        expected = """_.map(locales, function(locale, lng) {return (<button  type="button" className="btn btn-default">
            { i18n.t('name', {lng: locale}) }
        </button>)}.bind(this))"""
        assert.strictEqual spTransform(code), expected

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
        assert.strictEqual spTransform(code), expected

        return

    it 'should transform spClick + spRepeat', ->
        code = """<button spRepeat="(locale, lng) in locales" spClick={ this.changeLanguage(event, lng) } />"""
        expected = """_.map(locales, function(locale, lng) {return (<button  onClick={ (function(event) { this.changeLanguage(event, lng) }).bind(this) } />)}.bind(this))"""
        assert.strictEqual spTransform(code), expected
        return

    it 'should transform nested spClick + spRepeat', ->
        code = """<button spRepeat="(locale, lng) in locales" type="button" className="btn btn-default">
            { i18n.t('name', {lng: locale}) }
            <button spRepeat="(locale, lng) in locales" spClick={ this.changeLanguage(event, lng) } />
        </button>"""
        expected = """_.map(locales, function(locale, lng) {return (<button  type="button" className="btn btn-default">
            { i18n.t('name', {lng: locale}) }
            { _.map(locales, function(locale, lng) {return (<button  onClick={ (function(event) { this.changeLanguage(event, lng) }).bind(this) } />)}.bind(this)) }
        </button>)}.bind(this))"""
        assert.strictEqual spTransform(code), expected

        code = """var freact;

        freact = function() {
          return <button spRepeat="lng in locales" spClick={ this.changeLanguage(event, lng) } />;
        };"""
        expected = """var freact;

        freact = function() {
          return _.map(locales, function(lng) {return (<button  onClick={ (function(event) { this.changeLanguage(event, lng) }).bind(this) } />)}.bind(this));
        };"""
        assert.strictEqual spTransform(code), expected
        return

    it 'should not transform', ->
        code = """<div {...this.props}/>"""
        assert.strictEqual spTransform(code), code
        code = """var freact;

        freact = function() {
          return _.map(locales, function(lng) {return (<button  onClick={ (function(event) { this.changeLanguage(event, lng) }).bind(this) } />)}.bind(this));
        };"""
        assert.strictEqual spTransform(code), code
        return

    return
