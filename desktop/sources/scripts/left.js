"use strict";

function Left()
{
  this.theme = new Theme();
  this.controller = new Controller();
  this.dictionary = new Dictionary();
  this.operator = new Operator();
  this.navi = new Navi();
  this.stats = new Stats();
  this.go = new Go();
  this.project = new Project();
  this.reader = new Reader();
  this.insert = new Insert();

  this.textarea_el    = document.createElement('textarea');
  this.drag_el        = document.createElement('drag');

  this.selection = {word: null,index:1};

  this.words_count = null;
  this.lines_count = null;
  this.chars_count = null;
  this.suggestion = null;
  this.synonyms = null;
  this.last_char = "s"; // this is not a typo. it's bad code, but it has to be a length one string

  this.install = function(host = document.body)
  {
    host.appendChild(this.navi.el);
    host.appendChild(this.textarea_el);
    host.appendChild(this.stats.el);
    host.appendChild(this.drag_el);
    host.appendChild(this.operator.el);

    host.className = window.location.hash.replace("#","");

    this.textarea_el.setAttribute("autocomplete","off");
    this.textarea_el.setAttribute("autocorrect","off");
    this.textarea_el.setAttribute("autocapitalize","off");
    this.textarea_el.setAttribute("spellcheck","false");
    this.textarea_el.setAttribute("type","text");

    this.theme.install(host);
  }

  this.start = function()
  {
    this.theme.start();
    this.dictionary.start();

    this.textarea_el.focus();
    this.textarea_el.addEventListener('scroll', () => {
      if(!this.reader.active){ this.stats.on_scroll(); }
    });
    this.textarea_el.addEventListener('input', () => {
      this.project.page().commit();
    });

    this.go.to_page();
    this.textarea_el.setSelectionRange(0,0);

    this.dictionary.update();
    this.update();
  }

  this.select_autocomplete = function()
  {
    if(left.selection.word.trim() != "" && left.suggestion && left.suggestion.toLowerCase() != left.active_word().toLowerCase()){
      left.autocomplete();
    }else{
      left.inject("\u00a0\u00a0")
    }
  }

  this.select_synonym = function()
  {
    if(left.synonyms){
      left.replace_active_word_with(left.synonyms[left.selection.index % left.synonyms.length]);
      left.stats.update();
      left.selection.index = (left.selection.index + 1) % left.synonyms.length;
    }
  }

  this.select = function(from,to)
  {
    left.textarea_el.setSelectionRange(from,to);
  }

  this.select_word = function(target)
  {
    let from = left.textarea_el.value.split(target)[0].length;
    this.select(from,from+target.length);
  }

  this.select_line = function(id)
  {
    let lineArr = this.textarea_el.value.split(EOL,parseInt(id)+1)
    let arrJoin = lineArr.join(EOL)

    let from = arrJoin.length-lineArr[id].length;
    let to = arrJoin.length;

    this.select(from,to)
  }

  this.update = function(hard = false)
  {
    let next_char = left.textarea_el.value.substr(left.textarea_el.selectionEnd,1);

    left.selection.word = this.active_word();
    left.suggestion     = (next_char == "" || next_char == " " || next_char == EOL) ? left.dictionary.find_suggestion(left.selection.word) : null;
    left.synonyms       = left.dictionary.find_synonym(left.selection.word);
    left.selection.url  = this.active_url();

    this.project.update();
    this.navi.update();
    this.stats.update();
  }

  this.reload = function(force = false)
  {
    this.project.page().reload(force);
    this.load(this.project.page().text)
  }

  this.load = function(text)
  {
    this.textarea_el.value = text ? text : '';
    this.update();
  }

  // Location tools

  this.selected = function()
  {
    let from = this.textarea_el.selectionStart;
    let to = this.textarea_el.selectionEnd;
    let length = to - from;
    return this.textarea_el.value.substr(from,length);
  }

  this.active_word_location = function(position = left.textarea_el.selectionEnd)
  {
    let from = position - 1;

    // Find beginning of word
    while(from > -1){
      let char = this.textarea_el.value[from];
      if(!char || !char.match(/[a-z]/i)){
        break;
      }
      from -= 1;
    }

    // Find end of word
    let to = from+1;
    while(to < from+30){
      let char = this.textarea_el.value[to];
      if(!char || !char.match(/[a-z]/i)){
        break;
      }
      to += 1;
    }

    from += 1;

    return {from:from,to:to};
  }

  this.active_line_id = function()
  {
    let segments = left.textarea_el.value.substr(0,left.textarea_el.selectionEnd).split(EOL);
    return segments.length-1;
  }

  this.active_line = function()
  {
    let text = left.textarea_el.value;
    let lines = text.split(EOL);
    return lines[this.active_line_id()];
  }

  this.active_word = function()
  {
    let l = this.active_word_location();
    return left.textarea_el.value.substr(l.from,l.to-l.from);
  }

  this.active_url = function()
  {
    let words = this.active_line().split(" ");
    for(let id in words){
      if(words[id].indexOf("://") > -1 || words[id].indexOf("www.") > -1){
        return words[id];
      }
    }
    return null;
  }

  this.prev_character = function()
  {
    let l = this.active_word_location();
    return left.textarea_el.value.substr(l.from-1,1);
  }

  this.replace_active_word_with = function(word)
  {
    let l = this.active_word_location();
    let w = left.textarea_el.value.substr(l.from,l.to-l.from);

    // Preserve capitalization
    if(w.substr(0,1) == w.substr(0,1).toUpperCase()){
      word = word.substr(0,1).toUpperCase()+word.substr(1,word.length);
    }

    this.textarea_el.setSelectionRange(l.from, l.to);

    document.execCommand('insertText', false, word);

    this.textarea_el.focus();
  }

  this.replace_selection_with = function(characters)
  {
    document.execCommand('insertText', false, characters);
    this.update();
  }

  this.replace_line = function(id, new_text, del = false) // optional arg for deleting the line, used in actions
  {
    let lineArr = this.textarea_el.value.split(EOL,parseInt(id)+1)
    let arrJoin = lineArr.join(EOL)

    let from = arrJoin.length-lineArr[id].length;
    let to = arrJoin.length;

    //splicing the string
    let new_text_value = this.textarea_el.value.slice(0,del ? from-1: from) + new_text + this.textarea_el.value.slice(to)

    // the cursor automatically moves to the changed position, so we have to set it back
    let cursor_start = this.textarea_el.selectionStart;
    let cursor_end = this.textarea_el.selectionEnd;
    let old_length = this.textarea_el.value.length
    let old_scroll = this.textarea_el.scrollTop
    //setting text area
    this.load(new_text_value)
    //adjusting the cursor position for the change in length
    let length_dif = this.textarea_el.value.length - old_length
    if(cursor_start>to) {
    cursor_start += length_dif
    cursor_end += length_dif
    }
    //setting the cursor position
    if(this.textarea_el.setSelectionRange){
    this.textarea_el.setSelectionRange(cursor_start,cursor_end);
    }
    else if(this.textarea_el.createTextRange){
      let range = this.textarea_el.createTextRange();
      range.collapse(true);
      range.moveEnd('character',cursor_end);
      range.moveStart('character',cursor_start);
      range.select();
    }
    //setting the scroll position
    this.textarea_el.scrollTop = old_scroll
    //this function turned out a lot longer than I was expecting. Ah well :/
  }

  this.inject = function(characters = "__")
  {
    let pos = this.textarea_el.selectionStart;
    this.textarea_el.setSelectionRange(pos, pos);
    document.execCommand('insertText', false, characters);
    this.update();
  }

  this.inject_line = function(characters = "__")
  {
    left.select_line(left.active_line_id())
    this.inject(characters)
  }

  this.inject_multiline = function(characters = "__")
  {
    let lines = this.selected().match(/[^\r\n]+/g);
    let text = ""
    for(let id in lines){
      let line = lines[id];
      text += `${characters}${line}\n`
    }
    this.replace_selection_with(text);
  }

  this.find = function(word)
  {
    let text = left.textarea_el.value.toLowerCase();
    let parts = text.split(word.toLowerCase());
    let a = [];
    let sum = 0;

    for(let id in parts){
      let p = parts[id].length
      a.push(sum + p);
      sum += p + word.length;
    }

    a.splice(-1,1)

    return a;
  }

  this.autocomplete = function()
  {
    this.inject(left.suggestion.substr(left.selection.word.length,left.suggestion.length)+" ");
  }

  this.open_url = function(target = this.active_url())
  {
    if(!target){ return; }

    this.select_word(target);
    setTimeout(() => { require('electron').shell.openExternal(target) }, 500)
  }

  this.reset = function()
  {
    left.theme.reset();
    left.update();
  }
}

let EOL = (process.platform === 'win32' ? '\r\n' : '\n'); // '\r\n' Mayhaps?

