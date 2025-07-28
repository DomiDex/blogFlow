We have this problem. every time we submit we subumit a form the post is like this
"post": "[object Object][object Object][object Object][object Object][object Object][object Object][object Object]",

I research for solution. I nalyse it and make sure we are doing it right.

### Research

Based on my search, I found the solution to your issue! The problem you're experiencing is that you're getting Quill's Delta format (JSON) instead of HTML. Here are several ways to fix this:

## Solution 1: Ensure HTML Output (Recommended)

Your current code should actually work correctly since you're using `quill.root.innerHTML`. However, make sure you're not accidentally calling `quill.getContents()` anywhere, which returns Delta/JSON format.

Here's your corrected code with some improvements:

<!-- Include the Quill library -->
<script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>

<!-- Initialize Quill editor -->
<script>
document.addEventListener('DOMContentLoaded', function() {
  var quill = new Quill('#editor', {
    modules: {
      toolbar: [
        [{ header: [2, 3, 4, false] }],
        ['bold', 'italic','link', 'blockquote', 'code-block'],
        [{ list: 'ordered' }, { list: 'bullet' }]
      ]
    },
    placeholder: 'Compose an epic...',
    theme: 'snow'
  });

  // Update hidden field whenever content changes
  var about = document.querySelector('textarea[name=bodycopy]');
  
  quill.on('text-change', function(delta, oldDelta, source) {
    if (about) {
      about.value = quill.root.innerHTML;
    }
  });

  var form = document.querySelector('.rich_form-form');
  
  if (form) {
    form.addEventListener('submit', function(e) {
      // Ensure we have the latest content
      if (about) {
        about.value = quill.root.innerHTML;
        
        // Debug: Check what we're actually submitting
        console.log("Final HTML content:", about.value);
        console.log("Content type:", typeof about.value);
        console.log("Is it JSON?", about.value.startsWith('{'));
        
        // Verify it's HTML and not JSON
        if (about.value.startsWith('{') || about.value.startsWith('[')) {
          console.error("Warning: Content appears to be JSON, not HTML!");
          // Force HTML extraction
          about.value = quill.root.innerHTML || document.querySelector('.ql-editor').innerHTML;
        }
      }
      
      // Allow form to submit normally
      return true;
    });
  }
});
</script>
<!-- Include the Quill library -->
<script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>
<!-- Include Delta to HTML converter -->
<script src="https://cdn.jsdelivr.net/npm/quill-delta-to-html@0.12.1/dist/browser/bundle.min.js"></script>

<!-- Initialize Quill editor -->
<script>
document.addEventListener('DOMContentLoaded', function() {
  var quill = new Quill('#editor', {
    modules: {
      toolbar: [
        [{ header: [2, 3, 4, false] }],
        ['bold', 'italic','link', 'blockquote', 'code-block'],
        [{ list: 'ordered' }, { list: 'bullet' }]
      ]
    },
    placeholder: 'Compose an epic...',
    theme: 'snow'
  });

  // Function to convert Delta to HTML
  function deltaToHtml(delta) {
    var converter = new QuillDeltaToHtmlConverter(delta.ops, {});
    return converter.convert();
  }

  // Alternative function using temporary Quill instance
  function quillGetHTML(inputDelta) {
    var tempQuill = new Quill(document.createElement("div"));
    tempQuill.setContents(inputDelta);
    return tempQuill.root.innerHTML;
  }

  var form = document.querySelector('.rich_form-form');
  
  form.onsubmit = function() {
    var about = document.querySelector('textarea[name=bodycopy]');
    
    // Method 1: Direct HTML (recommended)
    about.value = quill.root.innerHTML;
    
    // Method 2: Convert Delta to HTML (if you specifically need Delta conversion)
    // var delta = quill.getContents();
    // about.value = deltaToHtml(delta);
    
    // Method 3: Alternative Delta conversion
    // var delta = quill.getContents();
    // about.value = quillGetHTML(delta);
    
    console.log("Submitted HTML:", about.value);
    
    return true; // Allow form submission
  };
});
</script>

## Key Points from My Research:

1. **Your current code should work correctly since `quill.root.innerHTML` returns HTML content, not JSON [Convert Quill Delta to HTML - Stack Overflow](https://stackoverflow.com/questions/39519950/convert-quill-delta-to-html)**
2. **The JSON/Delta format is returned when you use `quill.getContents()` instead of `quill.root.innerHTML` [Memberstack 2.0](https://docs.memberstack.com/hc/en-us/articles/13306228541339-Rich-Text-Form-to-Webflow-CMS)[Stack Overflow](https://stackoverflow.com/questions/67259843/how-do-i-set-quill-output-to-be-json-delta-instead-of-html)**
3. **The Memberstack documentation shows the exact same approach you're using: `about.value = quill.root.innerHTML;` [Memberstack 2.0](https://docs.memberstack.com/hc/en-us/articles/14278361423387--Code-Create-a-rich-text-based-custom-field-with-Webflow-Memberstack-using-Quill-js)[Flow Radar](https://www.flowradar.com/custom-code/rich-text-editor)**

## Debugging Steps:

1. **Check your console** - The debug version above will show you exactly what's being submitted
2. **Verify the selector** - Make sure `textarea[name=bodycopy]` is correct
3. **Check timing** - The `DOMContentLoaded` wrapper ensures Quill is fully loaded

## Alternative Methods:

If `quill.root.innerHTML` isn't working, you can also try:

- `document.querySelector('.ql-editor').innerHTML`
- Using a temporary Quill instance to convert Delta to HTML [Convert Quill Delta to HTML - Stack Overflow](https://stackoverflow.com/questions/39519950/convert-quill-delta-to-html)

The most likely issue is that somewhere in your code, you might be accidentally using `quill.getContents()` which returns the Delta/JSON format. The solutions above should resolve your issue and ensure you're always getting HTML content for your Webflow form submissions.

### Other Example

<style>
/*Prevents text area from resizing*/
	textarea {
	  resize: none;
	}
  .rte-wrap .ql-toolbar{
  	width: 100%;
  }
  #editor{
  	border-radius: 0px 0px 6px 6px;
  }
</style>

<!-- Include stylesheet -->
<link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">

<script>
var Webflow = Webflow || [];
Webflow.push(function() {

	// display error message
	function displayError(message) {
		hideLoading();
		failureMessage.innerText = message;
		failureMessage.style.display = 'block';
	}

	// hiding the loading indicator
	function hideLoading() {
		showForm();
		successMessage.style.display = 'none';
	}

	// hide the form
	function hideForm() {
		form.style.display = 'none';
	}

	// show the loading indicator
	function showLoading() {
		hideForm();
		successMessage.style.display = 'block';
	}

	// show the form
	function showForm() {
		form.style.display = 'block';
	}

	// listen for xhr events
	function addListeners(xhr) {
		xhr.addEventListener('loadstart', showLoading);
	}

	// add xhr settings
	function addSettings(xhr) {
		xhr.timeout = requestTimeout;
	}

	// triggered form submit 
	function triggerSubmit(event) {

		// prevent default behavior form submit behavior
		event.preventDefault();
		
		// setup + send xhr request
		let formData = new FormData(event.target);
		let xhr = new XMLHttpRequest();
		xhr.open('POST', event.srcElement.action);
		addListeners(xhr);
		addSettings(xhr);
		xhr.send(formData);

		// capture xhr response
		xhr.onload = function() {
			if (xhr.status === 302) {
				let data = JSON.parse(xhr.responseText);
				window.location.assign(event.srcElement.dataset.redirect + data.slug);
			} else {
				displayError(errorMessage);
			}
		}

		// capture xhr request timeout
		xhr.ontimeout = function() {
			displayError(errorMessageTimedOut);
		}
	}

	// replace with your form ID
	const form = document.getElementById('post-form');

	// set the Webflow Error Message Div Block ID to 'error-message'
	let failureMessage = document.getElementById('error-message');

	// set the Webflow Success Message Div Block ID to 'success-message'
	let successMessage = document.getElementById('success-message');

	// set request timeout in milliseconds (1000ms = 1second)
	let requestTimeout = 10000;

	// error messages
	let errorMessageTimedOut = 'Oops! Seems this timed out. Please try again.';
	let errorMessage = 'Oops! Something went wrong. Please try again.';

	// capture form submit
	form.addEventListener('submit', triggerSubmit);

});
</script>

<!-- Include the Quill library -->
<script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>

<!-- Initialize Quill editor -->
<script>
var quill = new Quill('#editor', {
    modules: {
        toolbar: [
        	 [{ 'header': [2, 3, 4, 5, 6, false] }],
        
           ['bold', 'italic', 'underline', 'strike'],
           ['blockquote', 'code-block', 'link'],

           
           [{ 'list': 'ordered'}, { 'list': 'bullet' }],

           ['clean']
       ]
    },
  placeholder: 'You can start typing here...',
  theme: 'snow'
});

var form = document.querySelector('#post-form');
form.onsubmit = function() {
  // Populate hidden form on submit
  var about = document.querySelector('textarea[name=Description]');
  about.value = quill.root.innerHTML;
 
  
  console.log("Submitted", $(form).serialize(), $(form).serializeArray());
  
  // No back end to actually submit to!

  return false;
};

</script>
