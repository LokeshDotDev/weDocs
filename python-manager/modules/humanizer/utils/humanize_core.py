"""
Core humanization utilities - Streamlit-free version
Extracted from pages/humanize_text.py for API usage
"""
import random
import re
import ssl
import warnings
import nltk
import spacy
from nltk.corpus import wordnet
from nltk.tokenize import sent_tokenize, word_tokenize

warnings.filterwarnings("ignore", category=FutureWarning)

########################################
# Download needed NLTK resources
########################################
def download_nltk_resources():
    try:
        _create_unverified_https_context = ssl._create_unverified_context
    except AttributeError:
        pass
    else:
        ssl._create_default_https_context = _create_unverified_https_context

    resources = ['punkt', 'averaged_perceptron_tagger',
                 'punkt_tab', 'wordnet', 'averaged_perceptron_tagger_eng']
    for r in resources:
        nltk.download(r, quiet=True)

download_nltk_resources()

########################################
# Prepare spaCy pipeline
########################################
nlp = None
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    print("⚠️  spaCy en_core_web_sm model not found. Install with: python -m spacy download en_core_web_sm")
    print("⚠️  Some humanization features will be limited without spaCy")

########################################
# Citation Regex
########################################
CITATION_REGEX = re.compile(
    r"\(\s*[A-Za-z&\-,\.\s]+(?:et al\.\s*)?,\s*\d{4}(?:,\s*(?:pp?\.\s*\d+(?:-\d+)?))?\s*\)"
)

########################################
# Helper: Word & Sentence Counts
########################################
def count_words(text):
    return len(word_tokenize(text))

def count_sentences(text):
    return len(sent_tokenize(text))

########################################
# Step 1: Extract & Restore Citations
########################################
def extract_citations(text):
    refs = CITATION_REGEX.findall(text)
    placeholder_map = {}
    replaced_text = text
    for i, r in enumerate(refs, start=1):
        placeholder = f"[[REF_{i}]]"
        placeholder_map[placeholder] = r
        replaced_text = replaced_text.replace(r, placeholder, 1)
    return replaced_text, placeholder_map

PLACEHOLDER_REGEX = re.compile(r"\[\s*\[\s*REF_(\d+)\s*\]\s*\]")

def restore_citations(text, placeholder_map):
    def replace_placeholder(match):
        idx = match.group(1)
        key = f"[[REF_{idx}]]"
        return placeholder_map.get(key, match.group(0))
    restored = PLACEHOLDER_REGEX.sub(replace_placeholder, text)
    return restored

########################################
# Step 2: Expansions, Synonyms, & Transitions
########################################
WHOLE_CONTRACTIONS = {
    "can't": "cannot",
    "won't": "will not",
    "shan't": "shall not",
    "ain't": "is not",
    "i'm": "i am",
    "it's": "it is",
    "we're": "we are",
    "they're": "they are",
    "you're": "you are",
    "he's": "he is",
    "she's": "she is",
    "we've": "we have",
    "they've": "they have",
    "i've": "i have",
    "you've": "you have",
    "isn't": "is not",
    "aren't": "are not",
    "wasn't": "was not",
    "weren't": "were not",
    "haven't": "have not",
    "hasn't": "has not",
    "hadn't": "had not",
    "doesn't": "does not",
    "don't": "do not",
    "didn't": "did not",
    "wouldn't": "would not",
    "shouldn't": "should not",
    "couldn't": "could not",
    "mightn't": "might not",
    "mustn't": "must not",
    "needn't": "need not",
}

REGEX_CONTRACTIONS = [
    (r"n't\b", " not"),
    (r"'ll\b", " will"),
    (r"'ve\b", " have"),
    (r"'re\b", " are"),
    (r"'d\b", " would"),
    (r"'m\b", " am"),
]

ACADEMIC_TRANSITIONS = [
    "Moreover,", "Furthermore,", "In addition,", "Additionally,",
    "Nevertheless,", "Nonetheless,", "However,", "Conversely,",
    "On the other hand,", "In contrast,", "Similarly,", "Likewise,",
    "Consequently,", "Therefore,", "Thus,", "Hence,",
    "For instance,", "For example,", "In particular,", "Notably,",
    "It is worth noting that", "Significantly,", "Interestingly,",
    "As a matter of fact,", "Indeed,", "In fact,", "Evidently,",
    "To illustrate,", "To clarify,", "Specifically,", "In essence,",
    "Broadly speaking,", "Generally speaking,", "By and large,",
    "To put it differently,", "In other words,", "That is to say,",
    "With this in mind,", "Given this,", "Accordingly,", "As such,",
]

def expand_contractions(text):
    tokens = word_tokenize(text)
    expanded = []
    for tok in tokens:
        lower_tok = tok.lower()
        if lower_tok in WHOLE_CONTRACTIONS:
            replacement = WHOLE_CONTRACTIONS[lower_tok]
            if tok[0].isupper():
                replacement = replacement.capitalize()
            expanded.append(replacement)
        else:
            replaced = tok
            for pattern, repl in REGEX_CONTRACTIONS:
                replaced = re.sub(pattern, repl, replaced, flags=re.IGNORECASE)
            expanded.append(replaced)
    return " ".join(expanded)

def get_synonym(word):
    """Get a synonym with better selection strategy for more natural text."""
    synsets = wordnet.synsets(word)
    all_syns = []
    
    # Try multiple synsets for more variety (up to 3)
    for synset in synsets[:3]:
        lemmas = synset.lemmas()
        syns = [
            lemma.name().replace("_", " ") 
            for lemma in lemmas 
            if lemma.name().lower() != word.lower() and "_" not in lemma.name()
        ]
        all_syns.extend(syns)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_syns = []
    for syn in all_syns:
        if syn.lower() not in seen:
            seen.add(syn.lower())
            unique_syns.append(syn)
    
    if unique_syns:
        return random.choice(unique_syns)
    return None

def replace_synonyms(text, p_syn=0.2):
    if nlp is None:
        return text
    doc = nlp(text)
    replaced = []
    for token in doc:
        # Preserve original whitespace from spacy token
        ws = token.whitespace_  # Correct spacy attribute for trailing whitespace
        
        # More aggressive replacement for adjectives and adverbs
        should_replace = False
        if token.pos_ in ("ADJ", "ADV"):
            should_replace = random.random() < (p_syn * 1.3)  # 30% more likely
        elif token.pos_ in ("NOUN", "VERB"):
            should_replace = random.random() < p_syn
        
        if should_replace and len(token.text) > 3:  # Skip very short words
            syn = get_synonym(token.text)
            text_out = syn if syn else token.text
        else:
            text_out = token.text
        replaced.append(text_out + ws)  # Use original whitespace, not forced spacer

    # Join directly; whitespace already preserved from original
    return "".join(replaced)

def add_academic_transitions(text, p_trans=0.2):
    sentences = sent_tokenize(text)
    result = []
    for sent in sentences:
        if random.random() < p_trans:
            trans = random.choice(ACADEMIC_TRANSITIONS)
            result.append(f"{trans} {sent}")
        else:
            result.append(sent)
    return " ".join(result)

def minimal_rewriting(text, p_syn=0.2, p_trans=0.2):
    text = expand_contractions(text)
    text = replace_synonyms(text, p_syn=p_syn)
    text = add_academic_transitions(text, p_trans=p_trans)
    return text

def preserve_linebreaks_rewrite(text, p_syn=0.2, p_trans=0.2):
    lines = text.split("\n")
    rewritten_lines = []
    for line in lines:
        if line.strip():
            line = expand_contractions(line)
            line = replace_synonyms(line, p_syn=p_syn)
            line = add_academic_transitions(line, p_trans=p_trans)
        rewritten_lines.append(line)
    return "\n".join(rewritten_lines)
